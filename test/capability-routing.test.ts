import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalog,
  configurationReason,
  constructCandidates,
  type CandidateRules,
  type Capability,
  type Evidence,
  type ExecutionContract
} from "../src/catalog.js";
import { digest } from "../src/canonical.js";
import { validate } from "../src/policy-guard.js";
import { makePlan, validExecution } from "../src/route-plan.js";
import { evidence as fixtureEvidence, execution, host, now } from "./routing-fixtures.js";
import { guardFixture } from "./policy-guard.test.js";
import { annotations, request, selection } from "./route-plan.test.js";

const ev = (id: string, level: Evidence["level"] = "REQUESTABLE", source: Evidence["source"] = "trusted_host"): Evidence =>
  ({ ...fixtureEvidence(id, level), source });

const baseEntries: Capability[] = [
  { id: "provider/model", kind: "model", content_digest: "model", evidence: ev("model"), effects: [] },
  { id: "worker", kind: "agent", content_digest: "profile", evidence: ev("agent"), effects: [] },
  { id: "fresh", kind: "context", content_digest: "fresh", evidence: ev("fresh"), effects: [] }
];

const capabilities: Capability[] = [
  { id: "skill:fmt", kind: "skill", content_digest: "fmt", evidence: ev("fmt"), effects: ["isolated_write"] },
  { id: "skill:listed", kind: "skill", content_digest: "listed", evidence: ev("listed", "REQUESTABLE", "tool_listing"), effects: [] },
  { id: "skill:discovered", kind: "skill", content_digest: "discovered", evidence: ev("discovered", "DISCOVERED"), effects: [] },
  { id: "skill:exfil", kind: "skill", content_digest: "exfil", evidence: ev("exfil"), effects: ["external_write"] },
  { id: "mcp:docs", kind: "mcp", content_digest: "docs", evidence: ev("docs"), effects: ["read"] },
  { id: "mcp:listed", kind: "mcp", content_digest: "mcp-listed", evidence: ev("mcp-listed", "REQUESTABLE", "tool_listing"), effects: [] },
  { id: "tool:lint", kind: "tool", content_digest: "lint", evidence: ev("lint"), effects: ["read"] },
  { id: "tool:spawner", kind: "tool", content_digest: "spawner", evidence: ev("spawner"), effects: ["spawn"] }
];

const contract = (overrides: Partial<ExecutionContract>): ExecutionContract =>
  ({ ...execution(), ...overrides }) as ExecutionContract;

function catalogFor(configurations: ExecutionContract[], entries: Capability[] = capabilities) {
  return buildCatalog({
    host, generation: 1,
    evidence: [fixtureEvidence("template"), fixtureEvidence("confinement", "ENFORCEABLE")],
    entries: [...baseEntries, ...entries],
    templates: [{ id: "template", digest: "template-digest", evidence_ref: "template",
      enforcement_refs: ["confinement"], configurations }]
  });
}

function rulesFor(overrides: Partial<CandidateRules> = {}): CandidateRules {
  return {
    construction_rule_digest: "construction", qualification_binding_ref: "qualification",
    authorized_reads: ["src"], owned_writes: ["src/file.ts"], allowed_origins: [],
    authorized_skills: [], authorized_mcps: [], authorized_tools: [],
    qualify: () => true, describe: () => "Authorized isolated update.", continuation_proven: () => false,
    ...overrides
  };
}

test("skills enter candidates only through catalog evidence and capsule authorization", () => {
  const catalog = catalogFor([
    contract({ skills: ["skill:fmt"] }),
    contract({ skills: ["skill:listed"] }),
    contract({ skills: ["skill:discovered"] }),
    contract({ skills: ["skill:exfil"] }),
    contract({ skills: ["skill:invented"] })
  ]);
  const authorized = rulesFor({ authorized_skills: ["skill:fmt", "skill:listed", "skill:discovered", "skill:exfil", "skill:invented"] });
  const [fmt, listed, discovered, exfil, invented] = catalog.templates[0].configurations;
  assert.equal(configurationReason(fmt, catalog, authorized, now), undefined);
  assert.equal(configurationReason(listed, catalog, authorized, now), "CAPABILITY_UNKNOWN");
  assert.equal(configurationReason(discovered, catalog, authorized, now), "CAPABILITY_UNKNOWN");
  assert.equal(configurationReason(exfil, catalog, authorized, now), "FORBIDDEN_EFFECT");
  assert.equal(configurationReason(invented, catalog, authorized, now), "CAPABILITY_UNKNOWN");
  assert.equal(configurationReason(fmt, catalog, rulesFor(), now), "EXCESS_GRANT");
  const snapshot = constructCandidates(catalog, authorized, now);
  assert.equal(snapshot.candidates.length, 2);
  assert.deepEqual(snapshot.exclusion_records.map((record) => record.reason).sort(),
    ["CAPABILITY_UNKNOWN", "CAPABILITY_UNKNOWN", "CAPABILITY_UNKNOWN", "FORBIDDEN_EFFECT"]);
});

test("MCP and tool grants follow the same catalog and least-privilege checks", () => {
  const catalog = catalogFor([
    contract({ mcps: ["mcp:docs"] }),
    contract({ mcps: ["mcp:listed"] }),
    contract({ tools: ["tool:lint"] }),
    contract({ tools: ["tool:spawner"] })
  ]);
  const rules = rulesFor({ authorized_mcps: ["mcp:docs", "mcp:listed"], authorized_tools: ["tool:lint", "tool:spawner"] });
  const [mcp, listed, tool, spawner] = catalog.templates[0].configurations;
  assert.equal(configurationReason(mcp, catalog, rules, now), undefined);
  assert.equal(configurationReason(listed, catalog, rules, now), "CAPABILITY_UNKNOWN");
  assert.equal(configurationReason(tool, catalog, rules, now), undefined);
  assert.equal(configurationReason(spawner, catalog, rules, now), "FORBIDDEN_EFFECT");
  assert.equal(configurationReason(mcp, catalog, rulesFor({ authorized_mcps: [] }), now), "EXCESS_GRANT");
  assert.equal(configurationReason(tool, catalog, rulesFor({ authorized_tools: [] }), now), "EXCESS_GRANT");
  assert.equal(constructCandidates(catalog, rules, now).candidates.length, 3);
});

test("least privilege rejects read, write, network and external-action expansion", () => {
  const external = contract({ external_writes_allowed: true } as unknown as Partial<ExecutionContract>);
  const catalog = catalogFor([
    contract({}),
    contract({ filesystem: { ...execution().filesystem, read_roots: ["src", "secrets"] } }),
    contract({ filesystem: { ...execution().filesystem, write_paths: ["src/file.ts", "src/other.ts"] } }),
    contract({ network: { mode: "read_only_allowlist", allowed_origins: ["https://api.example.com"] } }),
    external
  ]);
  const rules = rulesFor();
  const [baseline, overRead, overWrite, network] = catalog.templates[0].configurations;
  assert.equal(configurationReason(baseline, catalog, rules, now), undefined);
  assert.equal(configurationReason(overRead, catalog, rules, now), "EXCESS_GRANT");
  assert.equal(configurationReason(overWrite, catalog, rules, now), "EXCESS_GRANT");
  assert.equal(configurationReason(network, catalog, rules, now), "EXCESS_GRANT");
  assert.equal(configurationReason(network, catalog, rulesFor({ allowed_origins: ["https://api.example.com"] }), now), undefined);
  assert.equal(validExecution({ ...execution(), external_writes_allowed: true } as unknown as ExecutionContract), false);
  assert.equal(configurationReason(external, catalog, rules, now), "FORBIDDEN_EFFECT");
});

function guardFor(catalog: ReturnType<typeof catalogFor>, rules: CandidateRules, snapshot = constructCandidates(catalog, rules, now)) {
  const fixture = guardFixture();
  const routeRequest = request();
  routeRequest.routing_projection = { capsule_digest: "capsule", egress_policy_digest: "egress" };
  routeRequest.candidate_snapshot = snapshot;
  fixture.context.request = routeRequest;
  fixture.context.catalog = catalog;
  fixture.context.rules = rules;
  fixture.context.authorization.projection_digest = digest(routeRequest.routing_projection);
  return { context: fixture.context, plan: makePlan(snapshot.candidates[1], selection(routeRequest), annotations), snapshot };
}

test("Guard revalidates capability grants through the same catalog pipeline", () => {
  const authorized = rulesFor({ authorized_skills: ["skill:fmt"] });
  const catalog = catalogFor([contract({ skills: ["skill:fmt"] })]);
  const allowed = guardFor(catalog, authorized);
  assert.equal(allowed.snapshot.candidates.length, 2);
  assert.equal(validate(allowed.plan, allowed.context).verdict, "ALLOW");

  const snapshot = constructCandidates(catalog, authorized, now);
  const unauthorized = guardFor(catalog, rulesFor(), snapshot);
  assert.deepEqual(validate(unauthorized.plan, unauthorized.context), { verdict: "DENY", reason: "EXCESS_GRANT" });

  const staleCapability = capabilities.map((entry) =>
    entry.id === "skill:fmt" ? { ...entry, evidence: { ...entry.evidence, valid_until: 0 } } : entry);
  const withoutCapability = guardFor(catalogFor([contract({ skills: ["skill:fmt"] })], staleCapability), authorized, snapshot);
  assert.deepEqual(validate(withoutCapability.plan, withoutCapability.context), { verdict: "DENY", reason: "CAPABILITY_UNKNOWN" });
});
