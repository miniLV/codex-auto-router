import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { AttemptBudget } from "../src/budget.js";
import { digest } from "../src/canonical.js";
import {
  buildReceipt,
  encodeReceipt,
  recordedUsage,
  receiptDigest,
  ReceiptError,
  validReceipt,
  type ReceiptInput,
  type ReceiptProviderAttempt
} from "../src/receipt.js";
import { makePlan } from "../src/route-plan.js";
import type { RoutingFailure } from "../src/route-plan.js";
import { verifyCandidate, type ArtifactSnapshot, type VerifiedCandidate } from "../src/verification.js";
import { annotations, request, selection } from "./route-plan.test.js";

const counters = () => new AttemptBudget("main", ["unit"]).snapshot();
function base(): ReceiptInput {
  return {
    main_task_id: "main", task_unit_id: "unit", capsule_revision: 1,
    root_intent_digest: "intent", capsule_digest: "capsule",
    counters_before: counters(), counters_after: counters(),
    outcome: { kind: "preflight_failed", reason: "UNSAFE_PROJECTION" }
  };
}

function attempt(): ReceiptProviderAttempt {
  return { decision_id: "d1", attempt_index: 1, started_at: 0, finished_at: 10, status: "ok",
    input_tokens: "UNKNOWN", output_tokens: "UNKNOWN", request_digest: "request" };
}

async function verified(): Promise<VerifiedCandidate> {
  const baseline: ArtifactSnapshot = { entries: { a: "old" }, digest: digest({ a: "old" }) };
  const current: ArtifactSnapshot = { entries: { a: "new" }, digest: digest({ a: "new" }) };
  const result = await verifyCandidate({
    baseline, snapshot: async () => current, dependency_digest: async () => "deps",
    owned_paths: ["a"], acceptance_ids: ["a1"],
    commands: [{ id: "test", argv: ["node", "test.js"], cwd: ".", expected_exit: 0, dependency_paths: [], dependency_coverage: "complete" }],
    previous_results: [], read_complete_diff: async () => {},
    run: async () => ({ exit_code: 0, output_digest: "out" }),
    assess_acceptance: async () => ["a1"]
  });
  if (!result.ok) throw new Error("fixture failed");
  return result.candidate;
}

test("every outcome kind produces a complete receipt and rejects fictitious fields", async () => {
  const r = request();
  const rootPlan = makePlan(r.candidate_snapshot.candidates[0], selection(r, true), annotations);
  const delegatePlan = makePlan(r.candidate_snapshot.candidates[1], selection(r), annotations);
  const failure: RoutingFailure = { kind: "UNAVAILABLE", reason_code: "TIMEOUT", decision_id: "d1", provider_attempts: [] };
  const receipts: ReceiptInput[] = [
    base(),
    { ...base(), outcome: { kind: "adapter_failed", routing_failure: failure }, provider_attempts: [attempt()], usage_refs: ["root"] },
    { ...base(), decision_id: "d1", outcome: { kind: "guard_denied", reason: "PERMISSION_UNPROVEN" } },
    { ...base(), decision_id: "d1", outcome: { kind: "root_selected", plan: rootPlan }, provider_attempts: [attempt()] },
    { ...base(), decision_id: "d1", outcome: { kind: "delegated", plan: delegatePlan, execution_id: "e1" }, provider_attempts: [attempt()],
      violations: ["none"], safety_evidence_refs: ["confinement"] },
    { ...base(), decision_id: "d1", outcome: { kind: "candidate_rejected", execution_id: "e1",
      verification: { reason: "COMMAND_FAILED", commands: [] }, recovery: "restored" } },
    { ...base(), decision_id: "d1", candidate_digest: "candidate", outcome: { kind: "candidate_adopted", execution_id: "e1",
      disposition: "accepted", verification: await verified(), integration: "published" } },
    { ...base(), outcome: { kind: "pending", unmet_gate: "REVIEW_UNAVAILABLE" } },
    { ...base(), outcome: { kind: "cancelled", cleanup_state: "child_stop_evidence_pending" } }
  ];
  for (const input of receipts) {
    const receipt = buildReceipt(input);
    assert.equal(validReceipt(receipt), true, input.outcome.kind);
    assert.equal(receipt.schema_revision, 1);
    assert.equal(typeof receiptDigest(receipt), "string");
  }
  assert.throws(() => buildReceipt({
    ...base(), outcome: { kind: "preflight_failed", reason: "OVERSIZE" },
    provider_attempts: [attempt()], selection_evidence: selection(r)
  }), ReceiptError);
  assert.throws(() => buildReceipt({ ...base(), main_task_id: "" }), ReceiptError);
});

test("missing usage is UNKNOWN, never zero, and malformed attempts are rejected", () => {
  assert.equal(recordedUsage(undefined), "UNKNOWN");
  assert.equal(recordedUsage(0), 0);
  assert.throws(() => recordedUsage(-1), ReceiptError);
  const receipt = buildReceipt({ ...base(), outcome: { kind: "adapter_failed", routing_failure: {
    kind: "MALFORMED", reason_code: "BAD_JSON", decision_id: "d1", provider_attempts: []
  } }, provider_attempts: [attempt()] });
  assert.equal(receipt.provider_attempts[0].input_tokens, "UNKNOWN");
  const invalid = { ...receipt, provider_attempts: [{ ...attempt(), attempt_index: 0 }] };
  assert.equal(validReceipt(invalid), false);
  assert.equal(validReceipt({ ...receipt, provider_attempts: [{ ...attempt(), input_tokens: -3 }] }), false);
  assert.equal(validReceipt({ ...receipt, provider_attempts: [{ ...attempt(), status: "bad\nstatus" }] }), false);
});

test("receipts stay ephemeral unless an approved benchmark sanitization exists", () => {
  const receipt = buildReceipt({ ...base(), outcome: { kind: "pending", unmet_gate: "INTEGRATION_LEASE_UNAVAILABLE" } });
  assert.equal(encodeReceipt(receipt, { mode: "ephemeral" }), undefined);
  assert.equal(encodeReceipt(receipt, { mode: "benchmark" }), undefined);
  const encoded = encodeReceipt(receipt, { mode: "benchmark", approved_sanitization_ref: "manifest-7" });
  assert.ok(encoded);
  assert.equal(JSON.parse(encoded).schema_revision, 1);
  assert.equal(encoded, encodeReceipt(receipt, { mode: "benchmark", approved_sanitization_ref: "manifest-7" }));
  assert.throws(() => encodeReceipt({ ...receipt, schema_revision: 2 } as unknown as typeof receipt, {
    mode: "benchmark", approved_sanitization_ref: "manifest-7"
  }), ReceiptError);
});

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? sourceFiles(child) : [child];
  });
}

test("no routing module reads a receipt: receipts are evidence, never routing authority", () => {
  const root = process.cwd();
  for (const path of sourceFiles(join(root, "src"))) {
    if (!path.endsWith(".ts")) continue;
    const rel = relative(root, path);
    if (rel === join("src", "receipt.ts")) continue;
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*receipt\.js["']/, rel);
    assert.doesNotMatch(source, /receipt/i, rel);
  }
});
