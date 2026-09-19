import assert from "node:assert/strict";
import test from "node:test";
import { profilePasses, profilesDisjoint, qualify, type QualificationProfile } from "../src/qualification.js";

test("observable profile predicates must be disjoint, not just unique labels", () => {
  const p = { profile_id: "a", observable_predicate: { effect: ["read"] } };
  assert.equal(profilesDisjoint([p, { ...p, profile_id: "b" }]), false);
  assert.equal(profilesDisjoint([p, { profile_id: "b", observable_predicate: { effect: ["write"] } }]), true);
  assert.equal(profilesDisjoint([{ profile_id: "a", observable_predicate: {} }]), false);
});

test("quality precedes economics; raw token growth does not disqualify weighted savings", () => {
  const p = { quality_result: { endpoints: [{ id: "acceptance", margin: 0.01, lower_bound: 0 }],
    critical_regressions: 0, sufficient_power: true, complete_outcomes: true, passed: true },
    economic_result: { weighted_cost_margin: 0, flagship_consumption_margin: 0,
      lower_bounds: { weighted_cost: 0.1, flagship_consumption: -0.1 }, coverage: 1, missingness_bounded: true, passed: true }
  } as QualificationProfile;
  assert.equal(profilePasses(p), true);
  assert.equal(profilePasses({ ...p, quality_result: { ...p.quality_result, critical_regressions: 1 } }), false);
  assert.equal(profilePasses({ ...p, economic_result: { ...p.economic_result, missingness_bounded: false } }), false);
  assert.equal(qualify({ trusted_artifact_digests: [], authorized_research_digests: [], bindings: {} as never,
    traits: {}, candidate_families: [], review_class: "ordinary", now: 0 }).ok, false);
});
