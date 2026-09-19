import { digest } from "./canonical.js";
import type { ExecutionContract } from "./catalog.js";
import { validate, type GuardContext } from "./policy-guard.js";
import type { RoutePlan } from "./route-plan.js";

const permits = new WeakSet<object>();
declare const probeBrand: unique symbol;
export interface ProbeCommand {
  readonly [probeBrand]: true;
  execution_mode: "probe_read_only";
  main_task_id: string;
  task_unit_id: string;
  decision_id: string;
  execution_id: string;
  expected_state_digest: string;
  requested: ExecutionContract;
}

/** Emits a native command for Root; it does not itself spawn a model. */
export function prepareProbe(plan: RoutePlan, context: GuardContext, execution_id: string,
  state_digest: string): ProbeCommand | { denied: string } {
  const verdict = validate(plan, context);
  if (verdict.verdict === "DENY") return { denied: verdict.reason };
  if (plan.decision !== "delegate") return { denied: "ROOT_SELECTED" };
  if (!execution_id || !state_digest || plan.execution.filesystem.write_paths.length !== 0 ||
    plan.execution.context.mode !== "fresh") return { denied: "PROBE_NOT_READ_ONLY" };
  const effective = [...plan.execution.skills, ...plan.execution.mcps, ...plan.execution.tools];
  if (context.catalog.entries.some(e => effective.includes(e.id) && e.effects.some(x => x !== "read"))) return { denied: "PROBE_NOT_READ_ONLY" };
  const command = { execution_mode: "probe_read_only", main_task_id: context.request.main_task_id,
    task_unit_id: context.request.task_unit_id, decision_id: context.request.decision_id, execution_id,
    expected_state_digest: state_digest, requested: structuredClone(plan.execution) } as ProbeCommand;
  permits.add(command);
  return command;
}

export interface NativeCompletion {
  main_task_id: string; decision_id: string; execution_id: string;
  requested_digest: string; source: "trusted_host"; evidence_mode: "production" | "simulation";
  stopped: boolean; observed: Partial<ExecutionContract>;
}
export interface NativeHostBridge {
  evidence_mode: "production" | "simulation";
  invoke: (command: ProbeCommand, signal: AbortSignal) => Promise<NativeCompletion>;
}

export async function invokeProbe(command: ProbeCommand, bridge: NativeHostBridge, signal: AbortSignal): Promise<NativeCompletion> {
  if (!permits.delete(command) || signal.aborted) throw new Error("DISPATCH_DISARMED");
  const bound = structuredClone(command);
  const result = await bridge.invoke(bound, signal);
  if (signal.aborted) throw new Error("DISPATCH_CANCELLED_CLEANUP_REQUIRED");
  if (result.source !== "trusted_host" || result.evidence_mode !== bridge.evidence_mode ||
    result.main_task_id !== command.main_task_id || result.decision_id !== command.decision_id ||
    result.execution_id !== command.execution_id || result.requested_digest !== digest(bound.requested)) throw new Error("NATIVE_IDENTITY_MISMATCH");
  return result;
}
