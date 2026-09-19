import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { assessExecution, adoptAssessment } from "../src/execution-contract.js";
import type { NativeCompletion } from "../src/exec.js";
import { execution } from "./routing-fixtures.js";

test("unknown attribution never becomes MATCH and adoption preserves observations", () => {
  const requested = execution();
  const observed = structuredClone(requested) as Partial<typeof requested>;
  delete observed.model;
  const completion: NativeCompletion = { main_task_id: "main", decision_id: "decision", execution_id: "execution",
    requested_digest: digest(requested), source: "trusted_host", evidence_mode: "simulation", stopped: true, observed };
  const assessed = assessExecution(requested, completion);
  assert.equal(assessed.observation, "routing_metadata_unobservable");
  assert.equal(assessed.action, "verify_and_close_unit");
  const adopted = adoptAssessment(assessed, { verified: true, required_review_passed: true, integrated: true, attribution_exception_available: true });
  assert.equal(adopted.disposition, "accepted_under_unobservable");
  assert.equal(adopted.observation, "routing_metadata_unobservable");
  delete observed.sandbox;
  const unsafe = assessExecution(requested, completion);
  assert.equal(unsafe.violation, "permission_scope_violation");
  assert.equal(unsafe.adoption_exception_eligible, false);
});

test("wrong context is a safety violation and narrower tools are a contract failure", () => {
  const requested = execution(); requested.tools = ["reader"];
  const completion: NativeCompletion = { main_task_id: "main", decision_id: "decision", execution_id: "execution",
    requested_digest: digest(requested), source: "trusted_host", evidence_mode: "simulation", stopped: true,
    observed: { ...requested, tools: [] } };
  assert.equal(assessExecution(requested, completion).action, "reject_and_close_unit");
  completion.observed.context = { ...requested.context, context_packet_digest: "wrong" };
  assert.equal(assessExecution(requested, completion).violation, "context_boundary_violation");
});
