import type { FailureClass } from "./qualification.js";

export interface FailureEvidence {
  execution_id: string; task_unit_id: string; class: FailureClass; fault_id: string;
  restoration_result: "restored" | "pending";
  acceptance_digest: string; original_acceptance_digest: string;
  correction_scope_unchanged: boolean;
}
export interface BudgetSnapshot {
  main_task_id: string;
  semantic_decisions: Record<string, number>;
  http_attempts: Record<string, number>;
  worker_executions: number;
  delegated_reviews: number;
  root_review_used: boolean;
  integration_attempts: number;
  attribution_exception_used: boolean;
}
export class AttemptBudget {
  #state: BudgetSnapshot;
  #decisions = new Map<string, string>();
  #executions = new Map<string, string>();
  #reviewed = new Set<string>();
  #closed = new Set<string>();
  #failures: FailureEvidence[] = [];
  constructor(main_task_id: string, unitIds: string[]) {
    if (!main_task_id || unitIds.length === 0 || new Set(unitIds).size !== unitIds.length || unitIds.some(x => !x))
      throw new Error("INVALID_TASK_IDENTITY");
    this.#state = { main_task_id, semantic_decisions: Object.fromEntries(unitIds.map(id => [id, 0])), http_attempts: {},
      worker_executions: 0, delegated_reviews: 0, root_review_used: false, integration_attempts: 0, attribution_exception_used: false };
  }
  snapshot(): BudgetSnapshot { return structuredClone(this.#state); }
  thirdEligible(unit: string, qualifiedClasses: FailureClass[]): boolean {
    const last = this.#failures.at(-1);
    return this.#state.worker_executions === 2 && last !== undefined && last.task_unit_id === unit &&
      last.execution_id === [...this.#executions.keys()].at(-1) && last.restoration_result === "restored" &&
      last.acceptance_digest === last.original_acceptance_digest && last.correction_scope_unchanged &&
      qualifiedClasses.includes(last.class) && this.#failures.filter(f => f.class === last.class && f.fault_id === last.fault_id).length === 1;
  }
  reserveDecision(unit: string, decision: string, qualifiedClasses: FailureClass[] = []): void {
    const count = this.#state.semantic_decisions[unit];
    if (!Object.hasOwn(this.#state.semantic_decisions, unit) || !decision || this.#decisions.has(decision)) throw new Error("DECISION_IDENTITY");
    if (this.#closed.has(unit)) throw new Error("UNIT_CLOSED");
    if (count >= (this.thirdEligible(unit, qualifiedClasses) ? 3 : 2)) throw new Error("DECISION_BUDGET");
    this.#state.semantic_decisions[unit]++;
    this.#state.http_attempts = { ...this.#state.http_attempts, [decision]: 0 };
    this.#decisions.set(decision, unit);
  }
  reserveHttp(decision: string): number {
    if (!this.#decisions.has(decision) || this.#state.http_attempts[decision] >= 2) throw new Error("HTTP_BUDGET");
    return ++this.#state.http_attempts[decision];
  }
  reserveWorker(unit: string, execution: string, qualifiedClasses: FailureClass[] = []): void {
    if (!Object.hasOwn(this.#state.semantic_decisions, unit) || !execution || this.#executions.has(execution)) throw new Error("EXECUTION_IDENTITY");
    if (this.#state.worker_executions >= 3 || (this.#state.worker_executions === 2 && !this.thirdEligible(unit, qualifiedClasses)))
      throw new Error("EXECUTION_BUDGET");
    this.#state.worker_executions++;
    this.#executions.set(execution, unit);
  }
  recordFailure(failure: FailureEvidence): void {
    if (this.#executions.get(failure.execution_id) !== failure.task_unit_id ||
      this.#failures.some(f => f.execution_id === failure.execution_id)) throw new Error("FAILURE_IDENTITY");
    this.#failures.push(structuredClone(failure));
  }
  repeatedFault(failure: FailureEvidence): boolean {
    return this.#failures.some(f => f.class === failure.class && f.fault_id === failure.fault_id);
  }
  reserveReview(candidate: string, producer: "root" | "worker"): void {
    if (!candidate || this.#reviewed.has(candidate)) throw new Error("CANDIDATE_ALREADY_REVIEWED");
    if (producer === "root") {
      if (this.#state.root_review_used) throw new Error("ROOT_REVIEW_BUDGET");
      this.#state.root_review_used = true;
    } else {
      if (this.#state.delegated_reviews >= 3 || this.#state.delegated_reviews >= this.#state.worker_executions) throw new Error("REVIEW_BUDGET");
      this.#state.delegated_reviews++;
    }
    this.#reviewed.add(candidate);
  }
  recordIntegration(): number {
    this.#state.integration_attempts++;
    return this.#state.integration_attempts;
  }
  closeUnit(unit: string): void {
    if (!Object.hasOwn(this.#state.semantic_decisions, unit)) throw new Error("INVALID_TASK_IDENTITY");
    this.#closed.add(unit);
  }
  reserveAttributionException(): void {
    if (this.#state.attribution_exception_used) throw new Error("ATTRIBUTION_EXCEPTION_USED");
    this.#state.attribution_exception_used = true;
  }
}
