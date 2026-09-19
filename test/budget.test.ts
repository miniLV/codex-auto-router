import assert from "node:assert/strict";
import test from "node:test";
import { AttemptBudget, type FailureEvidence } from "../src/budget.js";

function failure(id: string, fault: string): FailureEvidence {
  return { execution_id: id, task_unit_id: "u", class: "verification", fault_id: fault,
    restoration_result: "restored", acceptance_digest: "acceptance", original_acceptance_digest: "acceptance", correction_scope_unchanged: true };
}
test("all units share worker caps and the third slot requires distinct qualified restored failure", () => {
  const b = new AttemptBudget("main", ["u", "sibling"]);
  b.reserveDecision("u", "d1"); b.reserveWorker("u", "e1"); b.recordFailure(failure("e1", "test-a"));
  b.reserveDecision("u", "d2"); b.reserveWorker("u", "e2"); b.recordFailure(failure("e2", "test-b"));
  assert.throws(() => b.reserveWorker("sibling", "e3", ["verification"]), /EXECUTION_BUDGET/);
  assert.throws(() => b.reserveDecision("u", "d3"), /DECISION_BUDGET/);
  b.reserveDecision("u", "d3", ["verification"]); b.reserveWorker("u", "e3", ["verification"]);
  assert.equal(b.snapshot().worker_executions, 3);
  assert.throws(() => b.reserveWorker("u", "e4", ["verification"]), /EXECUTION_BUDGET/);
  const copy = b.snapshot(); copy.worker_executions = 0;
  assert.equal(b.snapshot().worker_executions, 3);
});
test("closed units admit no further decisions and integration attempts are recorded", () => {
  const b = new AttemptBudget("main", ["u"]);
  b.reserveDecision("u", "d1");
  b.closeUnit("u");
  assert.throws(() => b.reserveDecision("u", "d2"), /UNIT_CLOSED/);
  assert.throws(() => b.closeUnit("missing"), /INVALID_TASK_IDENTITY/);
  assert.equal(b.recordIntegration(), 1);
  assert.equal(b.recordIntegration(), 2);
  assert.equal(b.snapshot().integration_attempts, 2);
});
test("transport and review reservations never refund or consume the Root review", () => {
  const b = new AttemptBudget("main", ["u"]);
  b.reserveDecision("u", "d"); b.reserveHttp("d"); b.reserveHttp("d");
  assert.throws(() => b.reserveHttp("d"), /HTTP_BUDGET/);
  b.reserveWorker("u", "e"); b.reserveReview("candidate", "worker");
  b.reserveReview("root-candidate", "root");
  assert.throws(() => b.reserveReview("candidate", "worker"), /ALREADY_REVIEWED/);
  assert.throws(() => b.reserveReview("next", "root"), /ROOT_REVIEW_BUDGET/);
  b.reserveAttributionException(); assert.throws(() => b.reserveAttributionException(), /ATTRIBUTION_EXCEPTION_USED/);
});
