import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalog, catalogFresh, constructCandidates, evidenceValid } from "../src/catalog.js";
import { catalog, evidence, host, now, rules } from "./routing-fixtures.js";

test("catalog digest is stable across discovery order and application evidence is not selectability", () => {
  const a = catalog();
  const b = buildCatalog({ ...a, entries: [...a.entries].reverse(), evidence: [...a.evidence].reverse() });
  assert.equal(a.digest, b.digest);
  for (const level of ["DISCOVERED", "APPLIED"] as const) assert.equal(evidenceValid(evidence("x", level), host, now), false);
  assert.equal(evidenceValid({ ...evidence("x"), class: "UNKNOWN" }, host, now), false);
  assert.equal(evidenceValid({ ...evidence("x"), source: "file" }, host, now), false);
  assert.equal(evidenceValid(evidence("x"), host, 1000), false);
  assert.equal(catalogFresh(a, { ...host, session_id: "other" }, now), false);
});

test("enumeration preserves all admitted contracts, deduplicates and retains root and exclusions", () => {
  const a = catalog();
  a.templates[0].configurations.push(structuredClone(a.templates[0].configurations[0]));
  const rebuilt = buildCatalog(a);
  const set = constructCandidates(rebuilt, rules, now);
  assert.equal(set.candidates.length, 2);
  assert.equal(set.candidates[0].candidate_id, "root");
  const denied = constructCandidates(rebuilt, { ...rules, owned_writes: [] }, now);
  assert.equal(denied.candidates.length, 1);
  assert.equal(denied.exclusion_records[0].reason, "EXCESS_GRANT");
});

test("inherited capability discovery and unenforced confinement cannot produce candidates", () => {
  for (const change of ["unknown", "expiry", "tool", "continuation"] as const) {
    const a = catalog();
    if (change === "unknown") a.evidence[0].class = "UNKNOWN";
    if (change === "expiry") a.evidence[0].valid_until = now;
    if (change === "tool") a.templates[0].configurations[0].tools.push("unlisted");
    if (change === "continuation") a.templates[0].configurations[0].context = {
      mode: "continuation", context_packet_digest: "packet", worker_id: "worker", handle_ref: "handle",
      previous_execution_id: "execution", ownership_digest: "ownership", revalidation_evidence_ref: "template"
    };
    assert.equal(constructCandidates(buildCatalog(a), rules, now).candidates.length, 1, change);
  }
});
