import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { reviewCandidate, reviewIsCurrent, reviewRequired, type ReviewPacket, type ReviewRisk } from "../src/review.js";
import { verifyCandidate, type ArtifactSnapshot, type VerifiedCandidate } from "../src/verification.js";
import { evidence, host, now } from "./routing-fixtures.js";

const risk: ReviewRisk = {
  persistent: true, public_interface: false, data_structure: false, security: false, permissions: false,
  judgment_calls: [], gaps: []
};

async function verifiedFixture(): Promise<VerifiedCandidate> {
  const baseline: ArtifactSnapshot = { entries: { a: "old" }, digest: digest({ a: "old" }) };
  const current: ArtifactSnapshot = { entries: { a: "new" }, digest: digest({ a: "new" }) };
  const result = await verifyCandidate({
    baseline, snapshot: async () => current, dependency_digest: async () => "deps",
    owned_paths: ["a"], acceptance_ids: ["a1"],
    commands: [{ id: "test", argv: ["node", "test.js"], cwd: ".", expected_exit: 0, dependency_paths: [], dependency_coverage: "complete" }],
    previous_results: [], read_complete_diff: async () => {},
    run: async () => ({ exit_code: 0, output_digest: "root-output" }),
    assess_acceptance: async () => ["a1"]
  });
  if (!result.ok) throw new Error(`fixture failed: ${result.reason}`);
  return result.candidate;
}

async function fixture() {
  const verification = await verifiedFixture();
  const packet: ReviewPacket = {
    main_task_id: "main", candidate_id: "candidate", producer: "worker",
    original_user_instruction_refs: ["user-instruction-1"], root_intent_digest: "intent",
    acceptance_ids: ["a1"], capsule_ref: "capsule", full_diff_ref: "full-diff",
    final_candidate_manifest_digest: verification.candidate_digest,
    dependency_digest: verification.dependency_digest,
    verification, risk, constraints: []
  };
  let workspace = "review-workspace";
  const reserved: Array<[string, string]> = [];
  const input = {
    host, now, confinement: evidence("confinement", "ENFORCEABLE"), read_only: evidence("read-only", "ENFORCEABLE") as ReturnType<typeof evidence> | undefined,
    hard_read_only_required: true, model: "gpt-6-astra", effort: "medium", fresh: true,
    descendants_allowed: false as const, active_worker: false,
    reserve: (candidate: string, producer: "root" | "worker") => { reserved.push([candidate, producer]); },
    snapshot: async () => ({ candidate: packet.final_candidate_manifest_digest, dependencies: packet.dependency_digest, review_workspace: workspace }),
    invoke: async () => ({ verdict: "ACCEPT" as const, findings: [], source: "trusted_host" as const,
      model: "gpt-6-astra", effort: "medium", fresh: true, stopped: true })
  };
  return { packet, input, reserved, mutateWorkspace: () => { workspace = "mutated"; } };
}

test("review triggers are fact-driven and cannot be suppressed by worker prose", () => {
  assert.equal(reviewRequired(risk), false);
  assert.equal(reviewRequired({ ...risk, persistent: false, public_interface: true, security: true }), false);
  for (const trigger of ["public_interface", "data_structure", "security", "permissions"] as const)
    assert.equal(reviewRequired({ ...risk, [trigger]: true }), true, trigger);
  assert.equal(reviewRequired({ ...risk, judgment_calls: ["took a judgment call"] }), true);
  assert.equal(reviewRequired({ ...risk, gaps: ["unverified edge case"] }), true);
});

test("fresh gpt-6-astra review binds the packet, reserves once and returns a current verdict", async () => {
  const f = await fixture();
  const verdict = await reviewCandidate(f.packet, f.input);
  assert.equal(verdict.verdict, "ACCEPT");
  assert.equal(verdict.tier, "ENFORCED_READ_ONLY");
  assert.equal(verdict.candidate_digest, f.packet.final_candidate_manifest_digest);
  assert.equal(verdict.dependency_digest, f.packet.dependency_digest);
  assert.deepEqual(f.reserved, [[f.packet.final_candidate_manifest_digest, "worker"]]);
  assert.equal(reviewIsCurrent(verdict, f.packet.final_candidate_manifest_digest, f.packet.dependency_digest), true);
});

test("original user intent independent of the capsule is required", async () => {
  const f = await fixture();
  f.packet.original_user_instruction_refs = [];
  assert.equal((await reviewCandidate(f.packet, f.input)).tier, "REVIEW_UNAVAILABLE");
  const g = await fixture();
  g.packet.root_intent_digest = "";
  assert.equal((await reviewCandidate(g.packet, g.input)).tier, "REVIEW_UNAVAILABLE");
});

test("missing hard read-only downgrades to behavioral and never overclaims enforcement", async () => {
  const behavioral = await fixture();
  behavioral.input.read_only = undefined;
  behavioral.input.hard_read_only_required = false;
  const verdict = await reviewCandidate(behavioral.packet, behavioral.input);
  assert.equal(verdict.tier, "BEHAVIORALLY_READ_ONLY");
  assert.equal(reviewIsCurrent(verdict, behavioral.packet.final_candidate_manifest_digest, behavioral.packet.dependency_digest), true);
  const required = await fixture();
  required.input.read_only = undefined;
  required.input.hard_read_only_required = true;
  assert.equal((await reviewCandidate(required.packet, required.input)).tier, "REVIEW_UNAVAILABLE");
});

test("any mutation or wrong reviewer context voids the review", async () => {
  const mutated = await fixture();
  mutated.input.invoke = async () => {
    mutated.mutateWorkspace();
    return { verdict: "ACCEPT" as const, findings: [], source: "trusted_host" as const,
      model: "gpt-6-astra", effort: "medium", fresh: true, stopped: true };
  };
  assert.equal((await reviewCandidate(mutated.packet, mutated.input)).tier, "REVIEW_UNAVAILABLE");

  const wrongModel = await fixture();
  wrongModel.input.model = "gpt-5.6-sol";
  assert.equal((await reviewCandidate(wrongModel.packet, wrongModel.input)).tier, "REVIEW_UNAVAILABLE");

  const notFresh = await fixture();
  notFresh.input.fresh = false;
  assert.equal((await reviewCandidate(notFresh.packet, notFresh.input)).tier, "REVIEW_UNAVAILABLE");

  const descendants = await fixture();
  (descendants.input as { descendants_allowed: boolean }).descendants_allowed = true;
  assert.equal((await reviewCandidate(descendants.packet, descendants.input)).tier, "REVIEW_UNAVAILABLE");

  const activeWorker = await fixture();
  activeWorker.input.active_worker = true;
  assert.equal((await reviewCandidate(activeWorker.packet, activeWorker.input)).tier, "REVIEW_UNAVAILABLE");

  const wrongContext = await fixture();
  wrongContext.input.invoke = async () => ({ verdict: "ACCEPT" as const, findings: [], source: "trusted_host" as const,
    model: "gpt-5.6-sol", effort: "medium", fresh: true, stopped: true });
  assert.equal((await reviewCandidate(wrongContext.packet, wrongContext.input)).tier, "REVIEW_UNAVAILABLE");
});

test("exhausted review budget leaves delivery pending and a mutation voids the stored verdict", async () => {
  const f = await fixture();
  f.input.reserve = () => { throw new Error("REVIEW_BUDGET"); };
  assert.equal((await reviewCandidate(f.packet, f.input)).tier, "REVIEW_UNAVAILABLE");

  const g = await fixture();
  const verdict = await reviewCandidate(g.packet, g.input);
  assert.equal(reviewIsCurrent(verdict, g.packet.final_candidate_manifest_digest, g.packet.dependency_digest), true);
  verdict.tier = "ENFORCED_READ_ONLY";
  verdict.verdict = "REVISE";
  assert.equal(reviewIsCurrent(verdict, g.packet.final_candidate_manifest_digest, g.packet.dependency_digest), false);
});
