import { canonicalJson, digest } from "./canonical.js";
import type { BudgetSnapshot } from "./budget.js";
import type { ExecutionContract } from "./catalog.js";
import type { Disposition, Violation } from "./execution-contract.js";
import type { RoutePlan, RoutingFailure, SelectionEvidence } from "./route-plan.js";
import type { ReviewTier, ReviewVerdict } from "./review.js";
import type { CommandResult, VerifiedCandidate } from "./verification.js";

export type TokenCount = number | "UNKNOWN";
export interface ReceiptProviderAttempt {
  decision_id: string;
  attempt_index: number;
  started_at: number;
  finished_at: number;
  status: string;
  sanitized_error_code?: string;
  provider_request_id?: string;
  input_tokens: TokenCount;
  output_tokens: TokenCount;
  retry_after?: string;
  request_digest: string;
  response_model?: string;
  response_digest?: string;
}
export type ReceiptOutcome =
  | { kind: "preflight_failed"; reason: string }
  | { kind: "adapter_failed"; routing_failure: RoutingFailure }
  | { kind: "guard_denied"; reason: string }
  | { kind: "root_selected"; plan: RoutePlan }
  | { kind: "delegated"; plan: RoutePlan; execution_id: string }
  | { kind: "candidate_rejected"; execution_id: string; verification: { reason: string; commands: CommandResult[] }; review?: ReviewVerdict; recovery: string }
  | { kind: "candidate_adopted"; execution_id?: string; disposition: Disposition; verification: VerifiedCandidate; review?: ReviewVerdict; integration: string }
  | { kind: "pending"; unmet_gate: string }
  | { kind: "cancelled"; cleanup_state: string };

export interface DecisionReceipt {
  schema_revision: 1;
  main_task_id: string;
  task_unit_id: string;
  capsule_revision: number;
  decision_id?: string;
  root_intent_digest: string;
  capsule_digest: string;
  projection_digest?: string;
  candidate_snapshot_digest?: string;
  host_fingerprint?: string;
  qualification_binding?: string;
  question_digest?: string;
  provider_model_requested?: string;
  selection_evidence?: SelectionEvidence;
  counters_before: BudgetSnapshot;
  counters_after: BudgetSnapshot;
  outcome: ReceiptOutcome;
  provider_attempts: ReceiptProviderAttempt[];
  requested_contract?: ExecutionContract;
  observed_contract?: Partial<ExecutionContract>;
  violations: Violation[];
  safety_evidence_refs: string[];
  review_packet_digest?: string;
  review_tier?: ReviewTier;
  review_verdict?: ReviewVerdict["verdict"];
  candidate_digest?: string;
  integration_result?: string;
  final_task_status?: string;
  usage_refs: string[];
  sanitized_evidence_refs: string[];
}

export type ReceiptInput = Omit<DecisionReceipt,
  "schema_revision" | "provider_attempts" | "violations" | "safety_evidence_refs" | "usage_refs" | "sanitized_evidence_refs"> &
  Partial<Pick<DecisionReceipt, "provider_attempts" | "violations" | "safety_evidence_refs" | "usage_refs" | "sanitized_evidence_refs">>;

export interface PersistencePolicy {
  mode: "ephemeral" | "benchmark";
  approved_sanitization_ref?: string;
}

export class ReceiptError extends Error {
  constructor(message: string) {
    super(`INVALID_RECEIPT: ${message}`);
    this.name = "ReceiptError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
const optionalText = (value: unknown): boolean => value === undefined || text(value);
const tokenCount = (value: unknown): value is TokenCount =>
  value === "UNKNOWN" || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const counters = (value: unknown): value is BudgetSnapshot => isRecord(value) &&
  text(value.main_task_id) && typeof value.worker_executions === "number" && typeof value.delegated_reviews === "number" &&
  typeof value.root_review_used === "boolean" && typeof value.attribution_exception_used === "boolean" &&
  isRecord(value.semantic_decisions) && isRecord(value.http_attempts);

export function recordedUsage(value: number | undefined): TokenCount {
  if (value === undefined) return "UNKNOWN";
  if (!Number.isSafeInteger(value) || value < 0) throw new ReceiptError("usage must be a non-negative safe integer or UNKNOWN");
  return value;
}

function attemptValid(attempt: unknown): attempt is ReceiptProviderAttempt {
  if (!isRecord(attempt)) return false;
  if (!text(attempt.decision_id) || !Number.isSafeInteger(attempt.attempt_index) || (attempt.attempt_index as number) < 1 ||
    !timestamp(attempt.started_at) || !timestamp(attempt.finished_at) || !text(attempt.status) ||
    !text(attempt.request_digest) || !tokenCount(attempt.input_tokens) || !tokenCount(attempt.output_tokens)) return false;
  return optionalText(attempt.sanitized_error_code) && optionalText(attempt.provider_request_id) &&
    optionalText(attempt.retry_after) && optionalText(attempt.response_model) && optionalText(attempt.response_digest);
}

function outcomeValid(outcome: unknown): outcome is ReceiptOutcome {
  if (!isRecord(outcome) || !text(outcome.kind)) return false;
  switch (outcome.kind) {
    case "preflight_failed":
    case "guard_denied":
      return text(outcome.reason);
    case "adapter_failed":
      return isRecord(outcome.routing_failure) && text(outcome.routing_failure.kind) &&
        text(outcome.routing_failure.reason_code) && text(outcome.routing_failure.decision_id) &&
        Array.isArray(outcome.routing_failure.provider_attempts);
    case "root_selected":
      return isRecord(outcome.plan) && outcome.plan.decision === "root";
    case "delegated":
      return isRecord(outcome.plan) && outcome.plan.decision === "delegate" && text(outcome.execution_id);
    case "candidate_rejected":
      return text(outcome.execution_id) && isRecord(outcome.verification) && text(outcome.verification.reason) &&
        Array.isArray(outcome.verification.commands) && text(outcome.recovery);
    case "candidate_adopted":
      return ["not_adopted", "accepted", "accepted_under_unobservable", "accepted_with_mismatch"].includes(String(outcome.disposition)) &&
        isRecord(outcome.verification) && text(outcome.integration) && optionalText(outcome.execution_id);
    case "pending":
      return text(outcome.unmet_gate);
    case "cancelled":
      return text(outcome.cleanup_state);
    default:
      return false;
  }
}

export function validReceipt(receipt: unknown): receipt is DecisionReceipt {
  if (!isRecord(receipt) || receipt.schema_revision !== 1) return false;
  if (!text(receipt.main_task_id) || !text(receipt.task_unit_id) || !Number.isSafeInteger(receipt.capsule_revision) ||
    !text(receipt.root_intent_digest) || !text(receipt.capsule_digest) || !counters(receipt.counters_before) ||
    !counters(receipt.counters_after) || !outcomeValid(receipt.outcome)) return false;
  if (![receipt.decision_id, receipt.projection_digest, receipt.candidate_snapshot_digest, receipt.host_fingerprint,
    receipt.qualification_binding, receipt.question_digest, receipt.provider_model_requested, receipt.review_packet_digest,
    receipt.review_tier, receipt.review_verdict, receipt.candidate_digest, receipt.integration_result,
    receipt.final_task_status].every(optionalText)) return false;
  if (!Array.isArray(receipt.provider_attempts) || !receipt.provider_attempts.every(attemptValid)) return false;
  if (![receipt.violations, receipt.safety_evidence_refs, receipt.usage_refs, receipt.sanitized_evidence_refs].every(
    (list) => Array.isArray(list) && list.every((item) => typeof item === "string"))) return false;
  if (receipt.requested_contract !== undefined && !isRecord(receipt.requested_contract)) return false;
  if (receipt.observed_contract !== undefined && !isRecord(receipt.observed_contract)) return false;
  if (receipt.selection_evidence !== undefined && !isRecord(receipt.selection_evidence)) return false;
  const attempts = receipt.provider_attempts as ReceiptProviderAttempt[];
  if (receipt.outcome.kind === "preflight_failed" &&
    (attempts.length > 0 || receipt.selection_evidence !== undefined)) return false;
  return true;
}

export function buildReceipt(input: ReceiptInput): DecisionReceipt {
  const receipt: DecisionReceipt = {
    schema_revision: 1,
    ...structuredClone(input),
    provider_attempts: structuredClone(input.provider_attempts ?? []),
    violations: structuredClone(input.violations ?? []),
    safety_evidence_refs: [...(input.safety_evidence_refs ?? [])],
    usage_refs: [...(input.usage_refs ?? [])],
    sanitized_evidence_refs: [...(input.sanitized_evidence_refs ?? [])]
  };
  if (!validReceipt(receipt)) throw new ReceiptError("receipt does not satisfy the Decision Receipt schema");
  return receipt;
}

export function receiptDigest(receipt: DecisionReceipt): string {
  if (!validReceipt(receipt)) throw new ReceiptError("receipt does not satisfy the Decision Receipt schema");
  return digest(receipt);
}

export function persistencePolicy(policy: PersistencePolicy): { persisted: boolean; reason: string } {
  if (policy.mode !== "benchmark") return { persisted: false, reason: "EPHEMERAL_BY_DEFAULT" };
  if (!text(policy.approved_sanitization_ref)) return { persisted: false, reason: "SANITIZATION_NOT_APPROVED" };
  return { persisted: true, reason: "APPROVED_BENCHMARK_PERSISTENCE" };
}

export function encodeReceipt(receipt: DecisionReceipt, policy: PersistencePolicy): string | undefined {
  if (!validReceipt(receipt)) throw new ReceiptError("receipt does not satisfy the Decision Receipt schema");
  if (!persistencePolicy(policy).persisted) return undefined;
  return canonicalJson(receipt);
}
