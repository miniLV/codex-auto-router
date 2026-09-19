import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { validate, type GuardContext } from "../src/policy-guard.js";
import { makePlan } from "../src/route-plan.js";
import { catalog, evidence, host, now, rules } from "./routing-fixtures.js";
import { request, policy, selection, annotations } from "./route-plan.test.js";

export function guardFixture() {
  const r = request();
  r.routing_projection = { capsule_digest: "capsule", egress_policy_digest: "egress" };
  const p = makePlan(r.candidate_snapshot.candidates[1], selection(r), annotations);
  const c: GuardContext = { request: r, policy, now, host, root: { model: "gpt-6-astra", effort: "high", evidence: evidence("root") },
    decision: { open: true, response_unused: true, request_digest: "request", question_digest: "question" }, catalog: catalog(), rules,
    capsule: { digest: "capsule", revision: 1, acceptance_ids: ["a"], original_acceptance_ids: ["a"], owned_paths: ["src/file.ts"],
      validation_digest: "validation", authorized_scope_digest: "scope" },
    authorization: { scope_digest: "scope", projection_digest: digest(r.routing_projection), egress_policy_digest: "egress", expires_at: 1000 },
    baseline: { id: "baseline", workspace_id: "isolated", owned_paths: ["src/file.ts"],
      recoverability_evidence: evidence("recovery", "ENFORCEABLE"), integration_evidence: evidence("integration", "ENFORCEABLE") },
    verification: [{ command_id: "test", before_result_ref: "pre-run", input_digest: "input", observed_by: "root" }],
    qualification: { ok: true, mode: "research", profile_id: "profile", binding_digest: "qualification", selection_policy: policy,
      max_worker_executions: 2, third_correction_failure_classes: [] },
    budget: { workers: 0, unit_decisions: 1, current_http_attempts: 1, third_eligible: false, delegated_reviews: 0, root_review_used: false },
    review: { required: true, model: "gpt-6-astra", effort: "medium", fresh: true, evidence: evidence("review", "ENFORCEABLE") } };
  return { plan: p, context: c };
}

test("Guard returns the identical plan or a terminal reason, never an alternate", () => {
  const f = guardFixture(); const result = validate(f.plan, f.context);
  assert.deepEqual(result, { verdict: "ALLOW", plan: f.plan });
  if (result.verdict === "ALLOW") assert.equal(result.plan, f.plan);
  const cases: Array<[string, (c: GuardContext) => void]> = [
    ["ROOT_CONDITION", c => { c.root.evidence.class = "UNKNOWN"; }],
    ["STALE_DECISION", c => { c.decision.response_unused = false; }],
    ["LOW_CONFIDENCE", c => { c.policy = { ...c.policy, confidence_floor: 0.95 }; }],
    ["CATALOG_CHANGED", c => { c.catalog.host.fingerprint = "changed"; }],
    ["ACCEPTANCE_WEAKENED", c => { c.capsule.acceptance_ids = []; }],
    ["UNAUTHORIZED", c => { c.authorization.expires_at = 0; }],
    ["UNSAFE_PROJECTION", c => { c.authorization.projection_digest = "changed"; }],
    ["VERIFICATION_MISSING", c => { c.verification = []; }],
    ["BASELINE_UNSAFE", c => { c.baseline.recoverability_evidence.level = "DISCOVERED"; }],
    ["EXCESS_GRANT", c => { c.rules = { ...c.rules, owned_writes: [] }; }],
    ["FANOUT_FORBIDDEN", c => { c.active_child_id = "active"; }],
    ["PROFILE_UNQUALIFIED", c => { c.qualification = { ok: false, reason: "missing" }; }],
    ["EXECUTION_BUDGET", c => { c.budget.workers = 3; }],
    ["THIRD_NOT_QUALIFIED", c => { c.budget.workers = 2; }],
    ["REVIEW_UNAVAILABLE", c => { c.review.fresh = false; }],
    ["REVIEW_BUDGET", c => { c.budget.delegated_reviews = 3; }]
  ];
  for (const [reason, mutate] of cases) {
    const fresh = guardFixture(); mutate(fresh.context);
    assert.deepEqual(validate(fresh.plan, fresh.context), { verdict: "DENY", reason }, reason);
  }
});

test("RootPlan does not fabricate child-only baseline or execution-budget prerequisites", () => {
  const f = guardFixture();
  const root = makePlan(f.context.request.candidate_snapshot.candidates[0], selection(f.context.request, true), annotations);
  f.context.baseline.id = "absent"; f.context.budget.workers = 3;
  assert.equal(validate(root, f.context).verdict, "ALLOW");
});
