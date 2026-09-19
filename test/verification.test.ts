import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { verifyCandidate, isVerifiedCandidate, type ArtifactSnapshot, type VerifiedCandidate, type VerificationCommand } from "../src/verification.js";

const snapshot = (entries: Record<string, unknown>): ArtifactSnapshot => ({ entries, digest: digest(entries) });
test("Root reruns affected commands, reuses only exact inputs and rejects self-reported acceptance", async () => {
  let runs = 0;
  const baseline = snapshot({ a: "old", b: "unchanged" }), current = snapshot({ a: "new", b: "unchanged" });
  const command: VerificationCommand = { id: "test", argv: ["node", "test.js"], cwd: ".", expected_exit: 0,
    dependency_paths: ["b"], dependency_coverage: "complete" };
  const input: Parameters<typeof verifyCandidate>[0] = { baseline, snapshot: async () => current, dependency_digest: async () => "deps",
    owned_paths: ["a"], acceptance_ids: ["a1"], commands: [command], previous_results: [],
    read_complete_diff: async () => {}, run: async () => { runs++; return { exit_code: 0, output_digest: "root-output" }; },
    assess_acceptance: async () => ["a1"] };
  const first = await verifyCandidate(input); assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(isVerifiedCandidate(first.candidate, current.digest, "deps"), true);
  input.previous_results = first.candidate.commands;
  assert.equal((await verifyCandidate(input)).ok, true); assert.equal(runs, 1);
  input.commands = [{ ...command, dependency_paths: ["a"] }];
  await verifyCandidate(input); assert.equal(runs, 2);
  input.assess_acceptance = async () => [];
  assert.equal((await verifyCandidate(input)).ok, false);
  assert.equal(isVerifiedCandidate({ ...first.candidate } as VerifiedCandidate, current.digest, "deps"), false);
});
test("complete manifest catches out-of-scope changes and mutations during tests", async () => {
  const base = snapshot({ a: "old" });
  const input: Parameters<typeof verifyCandidate>[0] = { baseline: base, snapshot: async () => snapshot({ a: "new", other: "unowned" }),
    dependency_digest: async () => "deps", owned_paths: ["a"], acceptance_ids: ["a"], commands: [], previous_results: [],
    read_complete_diff: async () => {}, run: async () => ({ exit_code: 0, output_digest: "out" }), assess_acceptance: async () => ["a"] };
  const result = await verifyCandidate(input);
  assert.deepEqual(result, { ok: false, reason: "OUT_OF_SCOPE_CHANGE", commands: [] });
});
