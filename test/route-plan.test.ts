import assert from "node:assert/strict";
import test from "node:test";
import { makePlan, validExecution, validPlan, validSelection, validSnapshot, type RouteRequest,
  type SelectionPolicy, type SelectionEvidence, type Annotations } from "../src/route-plan.js";
import { execution, snapshot } from "./routing-fixtures.js";

export const policy: SelectionPolicy = { id: "policy", confidence_floor: 0.7, question_template_digest: "template", binding_digest: "binding" };
export function request(): RouteRequest {
  return { decision_id: "decision", main_task_id: "main", task_unit_id: "unit", capsule_revision: 1,
    routing_projection: {}, candidate_snapshot: snapshot(), attempt_snapshot: { decision_count: 1, worker_execution_count: 0 },
    frozen_selection_policy_ref: "policy", qualification_binding_ref: "qualification", evidence_mode: "simulation" };
}
export function selection(r: RouteRequest, root = false): SelectionEvidence {
  const id = r.candidate_snapshot.candidates[1].candidate_id;
  return { decision_id: r.decision_id, candidate_snapshot_digest: r.candidate_snapshot.digest, provider_model: "jev-1.13.0",
    choice: root ? "root" : id, confidence: 0.9, probabilities: { root: root ? 0.9 : 0.1, [id]: root ? 0.1 : 0.9 },
    request_digest: "request", question_digest: "question", question_template_digest: policy.question_template_digest };
}
export const annotations: Annotations = { risk: { class: "ordinary", source: "capsule_and_policy" },
  benefit_class: { value: "research_unqualified", evidence_ref: "qualification" }, reason_codes: ["JEV_DELEGATE"] };

test("root and complete delegate plans round-trip with no invented or missing grants", () => {
  const r = request();
  assert.equal(validSnapshot(r.candidate_snapshot), true);
  for (const root of [false, true]) {
    const p = makePlan(r.candidate_snapshot.candidates[root ? 0 : 1], selection(r, root), annotations);
    assert.equal(validPlan(JSON.parse(JSON.stringify(p)), r, policy), true);
    assert.equal(validPlan({ ...p, cost: 0 } as unknown as typeof p, r, policy), false);
  }
  const c = execution();
  assert.equal(validExecution(c), true);
  const { tools, ...incomplete } = c;
  assert.equal(validExecution(incomplete), false);
  assert.equal(validExecution({ ...c, descendants_allowed: true }), false);
});

test("distribution is complete, finite and bound to the exact request and maximum choice", () => {
  const r = request();
  const s = selection(r);
  assert.equal(validSelection(s, r, policy), true);
  for (const patch of [{ confidence: NaN }, { decision_id: "other" }, { choice: "invented" },
    { choice: "root" }, { provider_model: "jev-latest" }, { probabilities: { root: 1 } }]) {
    assert.equal(validSelection({ ...s, ...patch }, r, policy), false);
  }
  const p = makePlan(r.candidate_snapshot.candidates[1], s, annotations);
  if (p.decision === "delegate") p.execution.reasoning_effort = "max";
  assert.equal(validPlan(p, r, policy), false);
});
