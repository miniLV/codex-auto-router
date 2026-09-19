import assert from "node:assert/strict";
import test from "node:test";
import { AttemptBudget, type FailureEvidence } from "../src/budget.js";
import { correctedCapsuleNarrows, MainTaskLifecycle } from "../src/lifecycle.js";

function setup(unitIds = ["u", "sibling"]) {
  const budget = new AttemptBudget("main", unitIds);
  const lifecycle = new MainTaskLifecycle({ main_task_id: "main", root_intent_digest: "intent", unit_ids: unitIds, budget });
  return { budget, lifecycle };
}

function failure(execution: string, fault: string, unit = "u", klass: FailureEvidence["class"] = "verification"): FailureEvidence {
  return {
    execution_id: execution, task_unit_id: unit, class: klass, fault_id: fault,
    restoration_result: "restored", acceptance_digest: "acceptance", original_acceptance_digest: "acceptance",
    correction_scope_unchanged: true
  };
}

function delegate(lifecycle: MainTaskLifecycle, unit: string, decision: string, execution: string) {
  const operation = lifecycle.reserveDecision(unit, decision);
  return lifecycle.planDelegate(unit, operation, operation.revision, {
    execution_id: execution, continuation: { mode: "fresh", proven: true }
  });
}

test("a unit failure closes only that unit and never starves siblings", () => {
  const { budget, lifecycle } = setup();
  const operation = lifecycle.reserveDecision("u", "d1");
  const outcome = lifecycle.decisionFailed("u", operation, operation.revision, "provider_failure");
  assert.equal(outcome.main, "OPEN");
  assert.equal(outcome.unit.state, "ROOT_DIRECT");
  assert.equal(outcome.unit.routing, "CLOSED");
  assert.deepEqual(outcome.actions, ["root_responsibility"]);
  assert.throws(() => lifecycle.reserveDecision("u", "d1b"), /UNIT_CLOSED/);
  assert.equal(lifecycle.reserveDecision("sibling", "d2").revision, 1);
  assert.equal(lifecycle.attemptState("u").decision_count, 1);
  assert.equal(budget.snapshot().semantic_decisions.u, 1);
  assert.equal(lifecycle.snapshot().latch_reason, undefined);
});

test("a Guard denial settles the decision and resolves to Root without substitution", () => {
  const { lifecycle } = setup(["u"]);
  const operation = lifecycle.reserveDecision("u", "d1");
  const outcome = lifecycle.guardDenied("u", "PERMISSION_UNPROVEN", operation, operation.revision);
  assert.equal(outcome.unit.state, "ROOT_DIRECT");
  assert.equal(outcome.unit.closure_reason, "guard_denied");
  assert.deepEqual(outcome.actions, ["root_responsibility"]);
});

test("correctable failure restores and reopens the unit only for a fresh Jev decision", () => {
  const { budget, lifecycle } = setup(["u"]);
  delegate(lifecycle, "u", "d1", "e1");
  lifecycle.executionCompleted("u", "e1");
  const outcome = lifecycle.verificationFailed("u", failure("e1", "test-a"));
  assert.deepEqual(outcome.actions, ["restore_baseline", "fresh_decision_required"]);
  assert.equal(outcome.unit.phase, "READY");
  assert.equal(outcome.unit.routing, "OPEN");
  assert.equal(budget.snapshot().worker_executions, 1);
  assert.equal(lifecycle.snapshot().operations.some((operation) => operation.kind === "execution" && !operation.consumed), false);
  delegate(lifecycle, "u", "d2", "e2");
  lifecycle.executionCompleted("u", "e2");
  const repeated = lifecycle.verificationFailed("u", failure("e2", "test-a"));
  assert.deepEqual(repeated.actions, ["restore_baseline", "stop_delegation", "root_judgment"]);
  assert.equal(repeated.unit.closure_reason, "repeated_fault");
  assert.equal(repeated.main, "OPEN");
});

test("a qualified third correction requires a fresh decision and a distinct documented fault", () => {
  const { budget, lifecycle } = setup(["u"]);
  delegate(lifecycle, "u", "d1", "e1");
  lifecycle.executionCompleted("u", "e1");
  lifecycle.verificationFailed("u", failure("e1", "test-a"));
  delegate(lifecycle, "u", "d2", "e2");
  lifecycle.executionCompleted("u", "e2");
  const reopened = lifecycle.verificationFailed("u", failure("e2", "test-b"), ["verification"]);
  assert.deepEqual(reopened.actions, ["restore_baseline", "fresh_decision_required"]);
  const operation = lifecycle.reserveDecision("u", "d3", ["verification"]);
  const third = lifecycle.planDelegate("u", operation, operation.revision, {
    execution_id: "e3", continuation: { mode: "fresh", proven: true }, qualifiedClasses: ["verification"]
  });
  assert.equal(third.unit.state, "DELEGATED");
  lifecycle.executionCompleted("u", "e3");
  const latched = lifecycle.verificationFailed("u", failure("e3", "test-c"));
  assert.equal(latched.main, "CLOSED");
  assert.equal(latched.latch_reason, "global_worker_budget");
  assert.equal(budget.snapshot().worker_executions, 3);
});

test("execution two without eligible correction evidence ends delegation for that unit", () => {
  const { lifecycle } = setup(["u"]);
  delegate(lifecycle, "u", "d1", "e1");
  lifecycle.executionCompleted("u", "e1");
  lifecycle.verificationFailed("u", failure("e1", "test-a"));
  delegate(lifecycle, "u", "d2", "e2");
  lifecycle.executionCompleted("u", "e2");
  const outcome = lifecycle.verificationFailed("u", failure("e2", "test-b"));
  assert.equal(outcome.main, "OPEN");
  assert.equal(outcome.unit.state, "ROOT_DIRECT");
  assert.equal(outcome.unit.closure_reason, "execution_delegation_ended");
  assert.equal(lifecycle.snapshot().latch_reason, undefined);
});

test("verification passes to review; RECONSIDER returns to Root; ACCEPT integrates", () => {
  const reconsider = setup(["u"]);
  delegate(reconsider.lifecycle, "u", "d1", "e1");
  reconsider.lifecycle.executionCompleted("u", "e1");
  assert.deepEqual(reconsider.lifecycle.verificationPassed("u", true).actions, ["review_candidate"]);
  const returned = reconsider.lifecycle.reviewOutcome("u", "RECONSIDER");
  assert.equal(returned.unit.state, "CLOSED");
  assert.equal(returned.unit.closure_reason, "reconsider");
  assert.deepEqual(returned.actions, ["stop_delegation", "root_judgment"]);

  const revised = setup(["u"]);
  delegate(revised.lifecycle, "u", "d1", "e1");
  revised.lifecycle.executionCompleted("u", "e1");
  revised.lifecycle.verificationPassed("u", true);
  const revision = revised.lifecycle.reviewOutcome("u", "REVISE", { failure: failure("e1", "semantic-1", "u", "semantic_revision") });
  assert.deepEqual(revision.actions, ["restore_baseline", "fresh_decision_required"]);

  const unavailable = setup(["u"]);
  delegate(unavailable.lifecycle, "u", "d1", "e1");
  unavailable.lifecycle.executionCompleted("u", "e1");
  unavailable.lifecycle.verificationPassed("u", true);
  assert.equal(unavailable.lifecycle.reviewOutcome("u", "REVIEW_UNAVAILABLE").unit.closure_reason, "review_unavailable");

  const accepted = setup(["u"]);
  delegate(accepted.lifecycle, "u", "d1", "e1");
  accepted.lifecycle.executionCompleted("u", "e1");
  accepted.lifecycle.verificationPassed("u", false);
  assert.equal(accepted.lifecycle.beginIntegration("u"), 1);
  const integrated = accepted.lifecycle.integrationOutcome("u", "integrated");
  assert.equal(integrated.unit.state, "ACCEPTED");
  assert.deepEqual(integrated.actions, ["accepted"]);
  assert.throws(() => accepted.lifecycle.reserveDecision("u", "d2"), /UNIT_CLOSED/);
});

test("integration conflict preserves shared state and returns the unit to Root", () => {
  const { lifecycle } = setup(["u"]);
  delegate(lifecycle, "u", "d1", "e1");
  lifecycle.executionCompleted("u", "e1");
  lifecycle.verificationPassed("u", false);
  lifecycle.beginIntegration("u");
  const outcome = lifecycle.integrationOutcome("u", "conflict");
  assert.equal(outcome.unit.closure_reason, "integration_conflict");
  assert.deepEqual(outcome.actions, ["preserve_shared_state", "root_judgment"]);
});

test("same-worker continuation is unselectable without proven handle evidence", () => {
  const { budget, lifecycle } = setup(["u"]);
  const operation = lifecycle.reserveDecision("u", "d1");
  assert.throws(() => lifecycle.planDelegate("u", operation, operation.revision, {
    execution_id: "e1", continuation: { mode: "continuation", proven: false }
  }), /CONTINUATION_UNPROVEN/);
  assert.equal(budget.snapshot().worker_executions, 0);
  const outcome = lifecycle.planDelegate("u", operation, operation.revision, {
    execution_id: "e1", continuation: { mode: "continuation", proven: true }
  });
  assert.equal(outcome.unit.state, "DELEGATED");
});

test("host completions are consumed once and reject unknown, stale, disarmed and cross-task events", () => {
  const { lifecycle } = setup(["u"]);
  const operation = lifecycle.reserveDecision("u", "d1");
  assert.throws(() => lifecycle.consumeHostCompletion(operation, "other"), /CROSS_TASK_EVENT/);
  assert.throws(() => lifecycle.consumeHostCompletion({ ...operation, operation_id: "op_999" }, "main"), /INVALID_OPERATION/);
  assert.throws(() => lifecycle.consumeHostCompletion({ ...operation, revision: 99 }, "main"), /STALE_REVISION/);
  lifecycle.consumeHostCompletion(operation, "main");
  assert.throws(() => lifecycle.consumeHostCompletion(operation, "main"), /OPERATION_CONSUMED/);
});

test("unit cancellation disarms the child and blocks work until cleanup settles", () => {
  const { lifecycle } = setup();
  delegate(lifecycle, "u", "d1", "e1");
  const executionOperation = lifecycle.snapshot().operations.find((operation) => operation.kind === "execution");
  assert.ok(executionOperation);
  const cancelled = lifecycle.cancelUnit("u");
  assert.deepEqual(cancelled.actions, ["stop_child", "preserve_recoverable_state"]);
  assert.equal(cancelled.unit.phase, "CANCELLED");
  assert.equal(lifecycle.snapshot().operations.find((operation) => operation.kind === "execution")?.disarmed, true);
  assert.doesNotMatch(cancelled.actions.join(","), /root_responsibility/);
  assert.throws(() => lifecycle.consumeHostCompletion({ operation_id: executionOperation.operation_id, revision: 1 }, "main"), /OPERATION_DISARMED/);
  assert.deepEqual(lifecycle.childStopped("u", "host-stop-evidence").actions, ["cleanup_settled"]);
  assert.throws(() => lifecycle.childStopped("u", "again"), /INVALID_TRANSITION/);
  assert.throws(() => lifecycle.reserveDecision("u", "d2"), /UNIT_CLOSED/);
  assert.equal(lifecycle.reserveDecision("sibling", "d2").revision, 1);
  assert.equal(lifecycle.cancelMainTask().main, "CLOSED");
  assert.throws(() => lifecycle.reserveDecision("sibling", "d3"), /MAIN_TASK_CLOSED/);
});

test("only enumerated events latch the Main Task, and corrections may only narrow", () => {
  const safety = setup(["u"]);
  const latched = safety.lifecycle.latch("safety_violation");
  assert.equal(latched.main, "CLOSED");
  assert.equal(latched.latch_reason, "safety_violation");
  assert.throws(() => safety.lifecycle.reserveDecision("u", "d1"), /MAIN_TASK_CLOSED/);

  assert.equal(correctedCapsuleNarrows(
    { acceptance_digest: "a", owned_paths: ["src/a.ts", "src/b.ts"] },
    { acceptance_digest: "a", owned_paths: ["src/a.ts"] }
  ), true);
  assert.equal(correctedCapsuleNarrows(
    { acceptance_digest: "a", owned_paths: ["src/a.ts"] },
    { acceptance_digest: "b", owned_paths: ["src/a.ts"] }
  ), false);
  assert.equal(correctedCapsuleNarrows(
    { acceptance_digest: "a", owned_paths: ["src/a.ts"] },
    { acceptance_digest: "a", owned_paths: ["src/a.ts", "src/c.ts"] }
  ), false);
});
