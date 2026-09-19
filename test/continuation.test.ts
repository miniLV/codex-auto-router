import assert from "node:assert/strict";
import test from "node:test";
import { continuationProven, type ContinuationEvidence } from "../src/continuation.js";
import { execution, host, evidence, now } from "./routing-fixtures.js";

test("continuation binds the stopped worker, restored baseline, ownership and unchanged tuple", () => {
  const previous = execution(); const next = execution();
  next.context = { mode: "continuation", context_packet_digest: "correction-packet", worker_id: "worker",
    handle_ref: "handle", previous_execution_id: "execution", ownership_digest: "ownership", revalidation_evidence_ref: "handle-proof" };
  const proof: ContinuationEvidence = { host, evidence: evidence("handle-proof"), worker_id: "worker", handle_ref: "handle",
    previous_execution_id: "execution", previous_contract: previous, ownership_digest: "ownership", restored_baseline_digest: "baseline",
    worker_stopped: true, acceptance_digest: "acceptance", previous_acceptance_digest: "acceptance" };
  assert.equal(continuationProven(next, proof, now), true);
  assert.equal(continuationProven(next, { ...proof, worker_stopped: false }, now), false);
  assert.equal(continuationProven({ ...next, model: "other" }, proof, now), false);
  assert.equal(continuationProven(next, { ...proof, handle_ref: "other" }, now), false);
  assert.equal(continuationProven(next, { ...proof, ownership_digest: "narrowed" }, now), false);
});
