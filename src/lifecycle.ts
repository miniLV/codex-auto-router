import { AttemptBudget, type FailureEvidence } from "./budget.js";
import type { FailureClass } from "./qualification.js";

export type MainTaskRoutingState = "OPEN" | "CLOSED";
export type TaskUnitRoutingState = "OPEN" | "ROOT_DIRECT" | "DELEGATED" | "ACCEPTED" | "CLOSED";
export type UnitPhase = "READY" | "DECIDING" | "EXECUTING" | "VERIFYING" | "REVIEWING" | "INTEGRATING" | "ACCEPTED" | "PENDING" | "CANCELLED";
export type UnitProducer = "root" | "worker";

export type MainLatchReason =
  | "safety_violation"
  | "unknown_safety"
  | "lost_lifecycle_state"
  | "counter_corruption"
  | "competing_routing_authority"
  | "authorization_ambiguity"
  | "global_worker_budget"
  | "host_trust_invalidated";

export type RoutingFailureReason = "provider_failure" | "low_confidence" | "unsafe_projection" | "unsupported_candidates";

export type UnitClosure =
  | "jev_root"
  | "guard_denied"
  | RoutingFailureReason
  | "attribution_closure"
  | "unit_cancellation"
  | "repeated_fault"
  | "scope_thrash"
  | "reconsider"
  | "review_unavailable"
  | "integration_conflict"
  | "execution_delegation_ended";

export interface Operation {
  operation_id: string;
  revision: number;
  main_task_id: string;
  unit_id: string;
  kind: "decision" | "execution";
  label: string;
}

export interface UnitView {
  unit_id: string;
  routing: "OPEN" | "CLOSED";
  state: TaskUnitRoutingState;
  phase: UnitPhase;
  producer: UnitProducer;
  closure_reason?: UnitClosure;
  decision_id?: string;
  execution_id?: string;
}

export interface LifecycleSnapshot {
  main_task_id: string;
  root_intent_digest: string;
  main: MainTaskRoutingState;
  latch_reason?: MainLatchReason;
  cancelled: boolean;
  units: UnitView[];
  operations: Array<{ operation_id: string; unit_id: string; kind: Operation["kind"]; label: string; consumed: boolean; disarmed: boolean }>;
}

export interface LifecycleOutcome {
  main: MainTaskRoutingState;
  latch_reason?: MainLatchReason;
  unit: UnitView;
  actions: string[];
}

export type LifecycleErrorCode =
  | "MAIN_TASK_CLOSED"
  | "UNKNOWN_UNIT"
  | "UNIT_CLOSED"
  | "CLEANUP_PENDING"
  | "INVALID_TRANSITION"
  | "INVALID_OPERATION"
  | "STALE_REVISION"
  | "OPERATION_CONSUMED"
  | "OPERATION_DISARMED"
  | "CROSS_TASK_EVENT"
  | "CONTINUATION_UNPROVEN"
  | "INVALID_CORRECTION";

export class LifecycleError extends Error {
  constructor(readonly code: LifecycleErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "LifecycleError";
  }
}

interface UnitRecord extends UnitView {
  revision: number;
}

interface OperationRecord {
  operation: Operation;
  consumed: boolean;
  disarmed: boolean;
}

export interface ContinuationClaim {
  mode: "fresh" | "continuation";
  proven: boolean;
}

export function correctedCapsuleNarrows(
  previous: { acceptance_digest: string; owned_paths: string[] },
  next: { acceptance_digest: string; owned_paths: string[] }
): boolean {
  if (!previous.acceptance_digest || previous.acceptance_digest !== next.acceptance_digest) return false;
  if (new Set(previous.owned_paths).size !== previous.owned_paths.length || new Set(next.owned_paths).size !== next.owned_paths.length) return false;
  return next.owned_paths.every((path) => previous.owned_paths.includes(path));
}

export class MainTaskLifecycle {
  readonly #mainTaskId: string;
  readonly #rootIntentDigest: string;
  readonly #budget: AttemptBudget;
  readonly #units = new Map<string, UnitRecord>();
  readonly #operations = new Map<string, OperationRecord>();
  readonly #cleanup = new Map<string, string>();
  #main: MainTaskRoutingState = "OPEN";
  #latch: MainLatchReason | undefined;
  #cancelled = false;
  #sequence = 0;

  constructor(input: { main_task_id: string; root_intent_digest: string; unit_ids: string[]; budget: AttemptBudget }) {
    if (!input.main_task_id || !input.root_intent_digest) throw new LifecycleError("INVALID_TRANSITION", "Main Task identity and RootIntent digest are required");
    if (input.unit_ids.length === 0 || new Set(input.unit_ids).size !== input.unit_ids.length || input.unit_ids.some((id) => !id))
      throw new LifecycleError("INVALID_TRANSITION", "finite, distinct unit IDs must be registered before routing");
    const budgetUnits = Object.keys(input.budget.snapshot().semantic_decisions);
    if (input.budget.snapshot().main_task_id !== input.main_task_id || budgetUnits.length !== input.unit_ids.length ||
      !input.unit_ids.every((id) => budgetUnits.includes(id))) throw new LifecycleError("INVALID_TRANSITION", "budget ledger does not match the registered Main Task");
    this.#mainTaskId = input.main_task_id;
    this.#rootIntentDigest = input.root_intent_digest;
    this.#budget = input.budget;
    for (const unit_id of input.unit_ids) this.#units.set(unit_id, {
      unit_id, routing: "OPEN", state: "OPEN", phase: "READY", producer: "root", revision: 0
    });
  }

  snapshot(): LifecycleSnapshot {
    return {
      main_task_id: this.#mainTaskId,
      root_intent_digest: this.#rootIntentDigest,
      main: this.#main,
      latch_reason: this.#latch,
      cancelled: this.#cancelled,
      units: [...this.#units.values()].map(({ revision, ...unit }) => structuredClone(unit)).sort((a, b) => a.unit_id.localeCompare(b.unit_id)),
      operations: [...this.#operations.values()].map((record) => ({ operation_id: record.operation.operation_id,
        unit_id: record.operation.unit_id, kind: record.operation.kind, label: record.operation.label,
        consumed: record.consumed, disarmed: record.disarmed }))
    };
  }

  attemptState(unitId: string): { decision_count: number; worker_execution_count: number } {
    const state = this.#budget.snapshot();
    if (!Object.hasOwn(state.semantic_decisions, unitId)) throw new LifecycleError("UNKNOWN_UNIT", unitId);
    return { decision_count: state.semantic_decisions[unitId], worker_execution_count: state.worker_executions };
  }

  reserveDecision(unitId: string, decisionId: string, qualifiedClasses: FailureClass[] = []): Operation {
    const unit = this.#openUnit(unitId);
    if (unit.phase !== "READY") throw new LifecycleError("INVALID_TRANSITION", `${unitId} is not ready for a decision`);
    this.#budget.reserveDecision(unitId, decisionId, qualifiedClasses);
    unit.phase = "DECIDING";
    unit.producer = "root";
    unit.decision_id = decisionId;
    unit.revision += 1;
    return this.#reserveOperation(unit, "decision", decisionId);
  }

  consumeHostCompletion(operation: { operation_id: string; revision: number }, eventMainTaskId: string): Operation {
    if (eventMainTaskId !== this.#mainTaskId) throw new LifecycleError("CROSS_TASK_EVENT", "event belongs to another Main Task");
    const record = this.#operations.get(operation.operation_id);
    if (!record) throw new LifecycleError("INVALID_OPERATION", "unknown operation ID");
    const unit = this.#units.get(record.operation.unit_id) as UnitRecord;
    if (record.consumed) throw new LifecycleError("OPERATION_CONSUMED", "host completion was already consumed");
    if (record.disarmed) throw new LifecycleError("OPERATION_DISARMED", "operation was disarmed by cancellation");
    if (record.operation.revision !== operation.revision || unit.revision !== operation.revision)
      throw new LifecycleError("STALE_REVISION", "completion does not match the current state revision");
    record.consumed = true;
    return record.operation;
  }

  decisionFailed(unitId: string, operation: Operation, expectedRevision: number, reason: RoutingFailureReason): LifecycleOutcome {
    this.#settle(unitId, operation, expectedRevision);
    return this.#closeUnit(unitId, "ROOT_DIRECT", "PENDING", reason, ["root_responsibility"]);
  }

  guardDenied(unitId: string, reason: string, operation: Operation, expectedRevision: number): LifecycleOutcome {
    if (!reason) throw new LifecycleError("INVALID_TRANSITION", "a Guard denial carries its reason");
    this.#settle(unitId, operation, expectedRevision);
    return this.#closeUnit(unitId, "ROOT_DIRECT", "PENDING", "guard_denied", ["root_responsibility"]);
  }

  planRoot(unitId: string, operation: Operation, expectedRevision: number): LifecycleOutcome {
    this.#settle(unitId, operation, expectedRevision);
    return this.#closeUnit(unitId, "ROOT_DIRECT", "PENDING", "jev_root", ["root_responsibility"]);
  }

  planDelegate(unitId: string, operation: Operation, expectedRevision: number, input: {
    execution_id: string; continuation: ContinuationClaim; qualifiedClasses?: FailureClass[];
  }): LifecycleOutcome {
    if (!input.execution_id) throw new LifecycleError("INVALID_TRANSITION", "a delegate plan carries its execution ID");
    if (input.continuation.mode === "continuation" && !input.continuation.proven)
      throw new LifecycleError("CONTINUATION_UNPROVEN", "same-worker continuation requires proof before reservation");
    const unit = this.#settle(unitId, operation, expectedRevision);
    try {
      this.#budget.reserveWorker(unitId, input.execution_id, input.qualifiedClasses ?? []);
    } catch (error) {
      if (error instanceof Error && error.message === "EXECUTION_BUDGET" && this.#budget.snapshot().worker_executions >= 3)
        return this.#latchMain("global_worker_budget", ["stop_all_work", "root_responsibility"]);
      return this.#closeUnit(unitId, "ROOT_DIRECT", "PENDING", "execution_delegation_ended", ["root_responsibility"]);
    }
    unit.state = "DELEGATED";
    unit.phase = "EXECUTING";
    unit.producer = "worker";
    unit.execution_id = input.execution_id;
    unit.revision += 1;
    this.#reserveOperation(unit, "execution", input.execution_id);
    return this.#outcome(unit, ["start_isolated_child"]);
  }

  executionCompleted(unitId: string, executionId: string): LifecycleOutcome {
    const unit = this.#requirePhase(unitId, "EXECUTING");
    if (unit.execution_id !== executionId) throw new LifecycleError("INVALID_OPERATION", "unknown execution identity");
    const record = [...this.#operations.values()].find((item) => item.operation.kind === "execution" &&
      item.operation.unit_id === unitId && item.operation.label === executionId);
    if (!record || record.consumed || record.disarmed) throw new LifecycleError("INVALID_OPERATION", "execution operation is not pending");
    record.consumed = true;
    unit.phase = "VERIFYING";
    unit.producer = "root";
    return this.#outcome(unit, ["verify_candidate"]);
  }

  verificationPassed(unitId: string, reviewRequired: boolean): LifecycleOutcome {
    const unit = this.#requirePhase(unitId, "VERIFYING");
    unit.phase = reviewRequired ? "REVIEWING" : "INTEGRATING";
    return this.#outcome(unit, reviewRequired ? ["review_candidate"] : ["integrate"]);
  }

  verificationFailed(unitId: string, failure: FailureEvidence, qualifiedClasses: FailureClass[] = []): LifecycleOutcome {
    const unit = this.#requirePhase(unitId, "VERIFYING");
    return this.#correctableFailure(unit, failure, qualifiedClasses);
  }

  reviewOutcome(unitId: string, verdict: "ACCEPT" | "REVISE" | "RECONSIDER" | "REVIEW_UNAVAILABLE", input: {
    failure?: FailureEvidence; qualifiedClasses?: FailureClass[];
  } = {}): LifecycleOutcome {
    const unit = this.#requirePhase(unitId, "REVIEWING");
    if (verdict === "ACCEPT") {
      unit.phase = "INTEGRATING";
      return this.#outcome(unit, ["integrate"]);
    }
    if (verdict === "RECONSIDER") return this.#closeUnit(unitId, "CLOSED", "PENDING", "reconsider", ["stop_delegation", "root_judgment"]);
    if (verdict === "REVIEW_UNAVAILABLE") return this.#closeUnit(unitId, "CLOSED", "PENDING", "review_unavailable", ["root_judgment", "pending_review"]);
    if (!input.failure) throw new LifecycleError("INVALID_TRANSITION", "REVISE requires bounded failure evidence");
    return this.#correctableFailure(unit, input.failure, input.qualifiedClasses ?? []);
  }

  beginIntegration(unitId: string): number {
    const unit = this.#requirePhase(unitId, "INTEGRATING");
    return this.#budget.recordIntegration();
  }

  integrationOutcome(unitId: string, result: "integrated" | "conflict"): LifecycleOutcome {
    const unit = this.#requirePhase(unitId, "INTEGRATING");
    if (result === "conflict") return this.#closeUnit(unitId, "CLOSED", "PENDING", "integration_conflict", ["preserve_shared_state", "root_judgment"]);
    unit.routing = "CLOSED";
    unit.state = "ACCEPTED";
    unit.phase = "ACCEPTED";
    unit.producer = "root";
    this.#budget.closeUnit(unitId);
    return this.#outcome(unit, ["accepted"]);
  }

  attributionClosure(unitId: string): LifecycleOutcome {
    return this.#closeUnit(unitId, "ROOT_DIRECT", "PENDING", "attribution_closure", ["root_validation", "close_unit_delegation"]);
  }

  scopeThrash(unitId: string): LifecycleOutcome {
    return this.#closeUnit(unitId, "CLOSED", "PENDING", "scope_thrash", ["stop_delegation", "root_judgment"]);
  }

  cancelUnit(unitId: string): LifecycleOutcome {
    const unit = this.#units.get(unitId);
    if (!unit) throw new LifecycleError("UNKNOWN_UNIT", unitId);
    if (unit.routing === "CLOSED" || this.#main === "CLOSED") throw new LifecycleError("UNIT_CLOSED", "unit or Main Task is already closed");
    const pendingExecution = [...this.#operations.values()].some((record) => !record.consumed &&
      record.operation.unit_id === unitId && record.operation.kind === "execution");
    for (const record of this.#operations.values()) if (record.operation.unit_id === unitId && !record.consumed) record.disarmed = true;
    unit.routing = "CLOSED";
    unit.state = "CLOSED";
    unit.phase = "CANCELLED";
    unit.producer = "root";
    unit.closure_reason = "unit_cancellation";
    this.#budget.closeUnit(unitId);
    if (pendingExecution) this.#cleanup.set(unitId, "");
    return this.#outcome(unit, pendingExecution ? ["stop_child", "preserve_recoverable_state"] : ["preserve_recoverable_state"]);
  }

  childStopped(unitId: string, evidenceRef: string): LifecycleOutcome {
    const unit = this.#units.get(unitId);
    if (!unit) throw new LifecycleError("UNKNOWN_UNIT", unitId);
    if (!this.#cleanup.has(unitId)) throw new LifecycleError("INVALID_TRANSITION", "no cleanup is pending for this unit");
    if (!evidenceRef) throw new LifecycleError("INVALID_TRANSITION", "trusted stop evidence is required");
    this.#cleanup.delete(unitId);
    return this.#outcome(unit, ["cleanup_settled"]);
  }

  latch(reason: MainLatchReason, actions: string[] = ["stop_all_work", "root_responsibility"]): LifecycleOutcome {
    return this.#latchMain(reason, actions);
  }

  cancelMainTask(): LifecycleOutcome {
    this.#main = "CLOSED";
    this.#cancelled = true;
    for (const record of this.#operations.values()) record.disarmed = true;
    for (const unit of this.#units.values()) if (unit.routing === "OPEN") {
      unit.routing = "CLOSED"; unit.state = "CLOSED"; unit.phase = "CANCELLED"; unit.producer = "root";
      this.#budget.closeUnit(unit.unit_id);
    }
    return { main: this.#main, unit: this.#firstUnit(), actions: ["stop_all_work", "preserve_recoverable_state"] };
  }

  #correctableFailure(unit: UnitRecord, failure: FailureEvidence, qualifiedClasses: FailureClass[]): LifecycleOutcome {
    if (failure.task_unit_id !== unit.unit_id || failure.execution_id !== unit.execution_id)
      throw new LifecycleError("INVALID_TRANSITION", "failure evidence does not belong to the current execution");
    if (this.#budget.repeatedFault(failure)) {
      this.#budget.recordFailure(failure);
      return this.#closeUnit(unit.unit_id, "CLOSED", "PENDING", "repeated_fault", ["restore_baseline", "stop_delegation", "root_judgment"]);
    }
    this.#budget.recordFailure(failure);
    const executions = this.#budget.snapshot().worker_executions;
    if (executions >= 3)
      return this.#latchMain("global_worker_budget", ["restore_baseline", "stop_all_work", "root_responsibility"]);
    if (executions === 2 && !this.#budget.thirdEligible(unit.unit_id, qualifiedClasses))
      return this.#closeUnit(unit.unit_id, "ROOT_DIRECT", "PENDING", "execution_delegation_ended", ["restore_baseline", "root_responsibility"]);
    unit.state = "OPEN";
    unit.phase = "READY";
    unit.producer = "root";
    unit.execution_id = undefined;
    unit.revision += 1;
    return this.#outcome(unit, ["restore_baseline", "fresh_decision_required"]);
  }

  #settle(unitId: string, operation: Operation, expectedRevision: number): UnitRecord {
    const unit = this.#requirePhase(unitId, "DECIDING");
    if (unit.revision !== expectedRevision) throw new LifecycleError("STALE_REVISION", "decision belongs to an older state revision");
    this.consumeHostCompletion(operation, operation.main_task_id);
    return unit;
  }

  #reserveOperation(unit: UnitRecord, kind: Operation["kind"], label: string): Operation {
    this.#sequence += 1;
    const operation: Operation = { operation_id: `op_${this.#sequence}`, revision: unit.revision,
      main_task_id: this.#mainTaskId, unit_id: unit.unit_id, kind, label };
    this.#operations.set(operation.operation_id, { operation, consumed: false, disarmed: false });
    return operation;
  }

  #openUnit(unitId: string): UnitRecord {
    if (this.#main !== "OPEN") throw new LifecycleError("MAIN_TASK_CLOSED", "the Main Task latch is closed");
    const unit = this.#units.get(unitId);
    if (!unit) throw new LifecycleError("UNKNOWN_UNIT", unitId);
    if (unit.routing === "CLOSED") throw new LifecycleError("UNIT_CLOSED", `${unitId} routing is closed`);
    if (this.#cleanup.has(unitId)) throw new LifecycleError("CLEANUP_PENDING", `${unitId} awaits trusted child-stop evidence`);
    return unit;
  }

  #requirePhase(unitId: string, phase: UnitPhase): UnitRecord {
    const unit = this.#openUnit(unitId);
    if (unit.phase !== phase) throw new LifecycleError("INVALID_TRANSITION", `${unitId} is in ${unit.phase}, expected ${phase}`);
    return unit;
  }

  #closeUnit(unitId: string, state: TaskUnitRoutingState, phase: UnitPhase, reason: UnitClosure, actions: string[]): LifecycleOutcome {
    const unit = this.#units.get(unitId);
    if (!unit) throw new LifecycleError("UNKNOWN_UNIT", unitId);
    unit.routing = "CLOSED";
    unit.state = state;
    unit.phase = phase;
    unit.producer = "root";
    unit.closure_reason = reason;
    this.#budget.closeUnit(unitId);
    return this.#outcome(unit, actions);
  }

  #latchMain(reason: MainLatchReason, actions: string[]): LifecycleOutcome {
    this.#main = "CLOSED";
    this.#latch = reason;
    for (const record of this.#operations.values()) record.disarmed = true;
    return { main: this.#main, latch_reason: this.#latch, unit: this.#firstUnit(), actions };
  }

  #firstUnit(): UnitView {
    const [unit] = this.#units.values();
    const { revision, ...view } = unit;
    return structuredClone(view);
  }

  #outcome(unit: UnitRecord, actions: string[]): LifecycleOutcome {
    const { revision, ...view } = unit;
    return { main: this.#main, latch_reason: this.#latch, unit: structuredClone(view), actions };
  }
}
