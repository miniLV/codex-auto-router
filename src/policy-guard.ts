import { digest } from "./canonical.js";
import { catalogFresh, configurationReason, evidenceValid, type CapabilityCatalog, type CandidateRules, type Evidence, type HostIdentity } from "./catalog.js";
import { validPlan, type RoutePlan, type RouteRequest, type SelectionPolicy } from "./route-plan.js";
import type { QualificationResult } from "./qualification.js";

export interface GuardContext {
  request: RouteRequest;
  policy: SelectionPolicy;
  now: number;
  host: HostIdentity;
  root: { model: string; effort: string; evidence: Evidence };
  decision: { open: boolean; response_unused: boolean; request_digest: string; question_digest: string };
  catalog: CapabilityCatalog;
  rules: CandidateRules;
  capsule: { digest: string; revision: number; acceptance_ids: string[]; original_acceptance_ids: string[];
    owned_paths: string[]; validation_digest: string; authorized_scope_digest: string };
  authorization: { scope_digest: string; projection_digest: string; egress_policy_digest: string; expires_at: number };
  baseline: { id: string; workspace_id: string; owned_paths: string[]; recoverability_evidence: Evidence; integration_evidence: Evidence };
  verification: Array<{ command_id: string; before_result_ref: string; input_digest: string; observed_by: "root" }>;
  qualification: QualificationResult;
  budget: { workers: number; unit_decisions: number; current_http_attempts: number; third_eligible: boolean;
    delegated_reviews: number; root_review_used: boolean };
  review: { required: boolean; model: string; effort: string; fresh: boolean; evidence: Evidence };
  active_child_id?: string;
}
export type GuardVerdict = { verdict: "ALLOW"; plan: RoutePlan } | { verdict: "DENY"; reason: string };

export function validate(plan: RoutePlan, c: GuardContext): GuardVerdict {
  const deny = (reason: string): GuardVerdict => ({ verdict: "DENY", reason });
  try {
    // Root tuple is an eligibility prerequisite, never an automatic model switch.
    if (!evidenceValid(c.root.evidence, c.host, c.now) || !["gpt-6-astra", "gpt-5.6-sol"].includes(c.root.model) ||
      !["medium", "high", "xhigh", "max", "ultra"].includes(c.root.effort)) return deny("ROOT_CONDITION");
    if (!validPlan(plan, c.request, c.policy)) return deny("INVALID_PLAN");
    if (!c.decision.open || !c.decision.response_unused || plan.selection.request_digest !== c.decision.request_digest ||
      plan.selection.question_digest !== c.decision.question_digest || c.request.capsule_revision !== c.capsule.revision ||
      c.request.routing_projection.capsule_digest !== c.capsule.digest) return deny("STALE_DECISION");
    if (c.policy.id !== c.request.frozen_selection_policy_ref || !Number.isFinite(c.policy.confidence_floor) ||
      c.policy.confidence_floor < 0 || c.policy.confidence_floor > 1) return deny("MISSING_SELECTION_POLICY");
    if (plan.selection.confidence < c.policy.confidence_floor) return deny("LOW_CONFIDENCE");
    if (c.authorization.expires_at <= c.now || c.authorization.scope_digest !== c.capsule.authorized_scope_digest)
      return deny("UNAUTHORIZED");
    if (c.authorization.projection_digest !== digest(c.request.routing_projection) ||
      c.authorization.egress_policy_digest !== c.request.routing_projection.egress_policy_digest) return deny("UNSAFE_PROJECTION");
    if (plan.decision === "root") return { verdict: "ALLOW", plan };
    if (!catalogFresh(c.catalog, c.host, c.now)) return deny("CATALOG_CHANGED");
    const reason = configurationReason(plan.execution, c.catalog, c.rules, c.now);
    if (reason) return deny(reason);
    if (!c.capsule.validation_digest || digest([...c.capsule.acceptance_ids].sort()) !==
      digest([...c.capsule.original_acceptance_ids].sort())) return deny("ACCEPTANCE_WEAKENED");
    if (new Set(c.capsule.owned_paths).size !== c.capsule.owned_paths.length ||
      c.capsule.owned_paths.some(p => !p || p.startsWith("/") || p.split("/").some(s => !s || s === ".." || s === ".")) ||
      !plan.execution.filesystem.write_paths.every(p => c.capsule.owned_paths.includes(p))) return deny("INVALID_OWNERSHIP");
    if (c.verification.length === 0 || c.verification.some(v => v.observed_by !== "root" || !v.command_id ||
      !v.before_result_ref || !v.input_digest)) return deny("VERIFICATION_MISSING");
    if (c.baseline.id !== plan.execution.filesystem.baseline_id || c.baseline.workspace_id !== plan.execution.filesystem.workspace_id ||
      !c.capsule.owned_paths.every(p => c.baseline.owned_paths.includes(p)) ||
      !evidenceValid(c.baseline.recoverability_evidence, c.host, c.now, true) ||
      !evidenceValid(c.baseline.integration_evidence, c.host, c.now, true)) return deny("BASELINE_UNSAFE");
    if (c.active_child_id) return deny("FANOUT_FORBIDDEN");
    const q = c.qualification;
    if (!q.ok || q.binding_digest !== c.request.qualification_binding_ref ||
      digest(q.selection_policy) !== digest(c.policy)) return deny("PROFILE_UNQUALIFIED");
    if (![c.budget.workers, c.budget.unit_decisions, c.budget.current_http_attempts, c.budget.delegated_reviews]
      .every(n => Number.isSafeInteger(n) && n >= 0)) return deny("COUNTER_CORRUPTION");
    if (c.budget.workers >= 3 || c.budget.current_http_attempts > 2 || c.budget.unit_decisions < 1 ||
      c.budget.unit_decisions > (c.budget.third_eligible ? 3 : 2)) return deny("EXECUTION_BUDGET");
    if (c.budget.workers === 2 && (q.max_worker_executions !== 3 || !c.budget.third_eligible)) return deny("THIRD_NOT_QUALIFIED");
    if (c.review.required || plan.annotations.risk.class === "review_required") {
      if (c.budget.delegated_reviews >= 3 || c.budget.root_review_used) return deny("REVIEW_BUDGET");
      if (c.review.model !== "gpt-6-astra" || c.review.effort !== "medium" || !c.review.fresh ||
        !evidenceValid(c.review.evidence, c.host, c.now, true)) return deny("REVIEW_UNAVAILABLE");
    }
    return { verdict: "ALLOW", plan };
  } catch { return deny("INVALID_CONTEXT"); }
}
