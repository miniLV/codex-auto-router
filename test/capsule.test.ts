import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, digest } from "../src/canonical.js";
import {
  buildRoutingProjection,
  deriveTaskTraits,
  projectWorkerPacket,
  serializeWorkerPacket,
  type EgressPolicyApproval,
  type RootIntent,
  type SummaryAttestation,
  type TaskCapsule,
  type TrustedCapsuleEvidence
} from "../src/capsule.js";
import { validateCorrection, validateRootIntent, validateTaskCapsule } from "../src/capsule.js";

function workspace(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "jev-capsule-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(root, "src", "b.ts"), "export const b = 1;\n");
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const intent: RootIntent = {
  main_task_id: "main-1",
  user_instruction_refs: ["user:1"],
  intent_digest: "intent-digest",
  acceptance: [{ id: "A1", original_requirement_ref: "user:1", condition: "The change is verified.", evidence_rule: "Root reruns the recorded command." }],
  authorization_ref: "auth:1",
  authorization_revision: 1
};

function verification(): TaskCapsule["verification"] {
  return [{
    command: ["npm", "test"],
    cwd: ".",
    expected_result: "pass",
    before_result_ref: "result:before-1",
    input_digest: digest({ command: ["npm", "test"] })
  }];
}

function capsule(paths: TaskCapsule["owned_paths"] = [{ canonical_relative_path: "src/a.ts", existing_or_new: "existing" }]): TaskCapsule {
  return {
    main_task_id: "main-1",
    task_unit_id: "unit-1",
    revision: 1,
    root_intent_ref: "intent-digest",
    objective: "Update the parser and preserve its acceptance behavior.",
    rationale: "The requested files contain the affected implementation.",
    acceptance_ids: ["A1"],
    owned_paths: paths,
    read_dependencies: [],
    interfaces: [],
    constraints: [],
    authorization_ref: "auth:1",
    side_effect_class: "bounded_write",
    verification: verification(),
    baseline_ref: "baseline:1",
    risk_flags: ["public-interface-review"],
    context_references: [],
    worker_packet_digest: "packet-digest"
  };
}

function evidence(root: string, paths: string[]): TrustedCapsuleEvidence {
  return {
    workspace_root: root,
    root_intent_ref: "intent-digest",
    authorization: { authorization_ref: "auth:1", authorization_revision: 1, side_effect_class: "bounded_write", exact_paths: paths },
    baseline: { baseline_ref: "baseline:1", exact_paths: paths },
    verification_result_refs: ["result:before-1"],
    verification_input_digests: [verification()[0].input_digest],
  };
}

function egress(): EgressPolicyApproval {
  return {
    approved: true,
    provider_id: "provider:test",
    approval_ref: "egress-1",
    policy_digest: "policy-digest",
    purpose: "route one task unit",
    allowed_content_categories: ["task_summary", "acceptance_summary", "interface_constraints", "risk_facts", "task_traits", "context_summary", "provenance"]
  };
}

test("canonical JSON sorts object keys, preserves arrays, and rejects non-JSON values", () => {
  assert.equal(canonicalJson({ b: 2, a: ["x", 1] }), '{"a":["x",1],"b":2}');
  assert.equal(digest({ a: 1 }), digest({ a: 1 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
  assert.throws(() => canonicalJson({ value: undefined }));
  assert.throws(() => canonicalJson(Number.POSITIVE_INFINITY));
  assert.throws(() => canonicalJson(1n));
});

test("capsule validation binds literal files, argv verification, authorization, and baseline evidence", () => {
  const fixture = workspace();
  try {
    const result = validateTaskCapsule(capsule(), intent, evidence(fixture.root, ["src/a.ts"]));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.utf8_bytes > 0, true);

    const commandObject = { ...capsule(), verification: [{ ...verification()[0], command: "npm test" }] };
    const invalid = validateTaskCapsule(commandObject, intent, evidence(fixture.root, ["src/a.ts"]));
    assert.equal(invalid.ok, false);

    const malformedArgv = { ...capsule(), verification: [{ ...verification()[0], command: ["npm", 7] }] };
    const malformedArgvResult = validateTaskCapsule(malformedArgv, intent, evidence(fixture.root, ["src/a.ts"]));
    assert.equal(malformedArgvResult.ok, false);
    assert.deepEqual((malformedArgv.verification[0] as { command: unknown[] }).command, ["npm", 7]);

    const secondVerification = {
      command: ["npm", "run", "typecheck"],
      cwd: ".",
      expected_result: "pass",
      before_result_ref: "result:before-2",
      input_digest: digest({ command: ["npm", "run", "typecheck"] })
    };
    const twoVerifications = { ...capsule(), verification: [verification()[0], secondVerification] };
    const swappedEvidence = {
      ...evidence(fixture.root, ["src/a.ts"]),
      verification_result_refs: ["result:before-2", "result:before-1"],
      verification_input_digests: [secondVerification.input_digest, verification()[0].input_digest]
    };
    assert.equal(validateTaskCapsule(twoVerifications, intent, swappedEvidence).ok, false);

    const noBaseline = validateTaskCapsule({ ...capsule(), baseline_ref: "" }, intent, evidence(fixture.root, ["src/a.ts"]));
    assert.equal(noBaseline.ok, false);
  } finally {
    fixture.cleanup();
  }
});

test("path validation rejects overlap, case aliases, directories, and escaping symlinks", () => {
  const fixture = workspace();
  const outside = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "jev-capsule-outside-"));
  try {
    mkdirSync(join(fixture.root, "src", "directory"));
    writeFileSync(join(outside, "secret.ts"), "secret\n");
    symlinkSync(join(outside, "secret.ts"), join(fixture.root, "src", "escape.ts"));
    const cases: TaskCapsule[] = [
      capsule([{ canonical_relative_path: "src/a.ts", existing_or_new: "existing" }, { canonical_relative_path: "src/a.ts/child", existing_or_new: "new" }]),
      capsule([{ canonical_relative_path: "src/A.ts", existing_or_new: "existing" }]),
      capsule([{ canonical_relative_path: "src/directory", existing_or_new: "existing" }]),
      capsule([{ canonical_relative_path: "src/escape.ts", existing_or_new: "existing" }]),
      capsule([{ canonical_relative_path: "src/../a.ts", existing_or_new: "existing" }])
    ];
    for (const invalid of cases) assert.equal(validateTaskCapsule(invalid, intent, evidence(fixture.root, invalid.owned_paths.map((path) => path.canonical_relative_path))).ok, false);
  } finally {
    fixture.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("correction preserves every acceptance id and only narrows ownership", () => {
  const fixture = workspace();
  try {
    const previous = capsule([
      { canonical_relative_path: "src/a.ts", existing_or_new: "existing" },
      { canonical_relative_path: "src/b.ts", existing_or_new: "existing" }
    ]);
    const corrected = { ...previous, revision: 2, owned_paths: [{ canonical_relative_path: "src/a.ts", existing_or_new: "existing" }] };
    assert.equal(validateCorrection(previous, corrected, intent, evidence(fixture.root, ["src/a.ts", "src/b.ts"])).ok, true);
    assert.equal(validateCorrection(previous, { ...corrected, acceptance_ids: [] }, intent, evidence(fixture.root, ["src/a.ts", "src/b.ts"])).ok, false);
    assert.equal(validateCorrection(previous, { ...previous, revision: 2, owned_paths: [...previous.owned_paths, { canonical_relative_path: "src/new.ts", existing_or_new: "new" }] }, intent, evidence(fixture.root, ["src/a.ts", "src/b.ts"])).ok, false);
  } finally {
    fixture.cleanup();
  }
});

test("traits are deterministic facts and byte measurement is separate from provider tokens", () => {
  const value = capsule();
  const traits = deriveTaskTraits(value, intent, { context_bytes: 4096, persistent_change: true });
  assert.deepEqual(traits, {
    owned_file_count_bucket: "1",
    changed_language: ["typescript"],
    side_effect_class: "bounded_write",
    public_interface_touched: false,
    verification_count: 1,
    context_size_bucket: "4-16KiB",
    persistent_change: true,
    risk_flags: ["public-interface-review"]
  });
});

test("projection requires approved egress, provenance, and an explicit neutral Root attestation", () => {
  const value = capsule();
  const provenance = [
    { kind: "root_authored" as const, ref: "task-summary-1", content_category: "task_summary" as const, authority: "fact" as const },
    { kind: "root_authored" as const, ref: "acceptance-summary-1", content_category: "acceptance_summary" as const, authority: "fact" as const },
    { kind: "root_authored" as const, ref: "interface-constraints-1", content_category: "interface_constraints" as const, authority: "fact" as const },
    { kind: "root_authored" as const, ref: "risk-facts-1", content_category: "risk_facts" as const, authority: "fact" as const },
    { kind: "measured_repository_fact" as const, ref: "task-traits-1", content_category: "task_traits" as const, authority: "fact" as const },
    { kind: "root_authored" as const, ref: "context-summary-1", content_category: "context_summary" as const, authority: "fact" as const },
    { kind: "trusted_host_policy_fact" as const, ref: "provenance-1", content_category: "provenance" as const, authority: "fact" as const }
  ];
  const summaryAttestations: SummaryAttestation[] = [
    ["objective_summary", "task-summary-1"],
    ["acceptance_summaries", "acceptance-summary-1"],
    ["interface_constraints", "interface-constraints-1"],
    ["risk_flags", "risk-facts-1"],
    ["relevant_context_summary", "context-summary-1"]
  ].map(([field, provenance_ref]) => ({ field: field as SummaryAttestation["field"], provenance_ref, attested_by: "root" as const, classification: "root_authored" as const, route_directed: false, meaning_preserved: true }));
  const base = {
    objective_summary: 'Preserve the literal "root" and "delegate" identifiers in the quoted task data.',
    acceptance_summaries: [{ id: "A1", summary: "The change is verified." }],
    interface_constraints: [],
    relevant_context_summary: "No additional context is needed.",
    context_complete: true,
    context_bytes: 4096,
    persistent_change: true,
    provenance,
    summary_attestations: summaryAttestations,
    egress_policy: egress()
  };
  const valid = buildRoutingProjection(intent, value, base);
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.egress_policy_digest, "policy-digest");
    assert.equal("provider_id" in valid.value, false);
    assert.doesNotMatch(JSON.stringify(valid.value), /route-directed/);
  }
  const unsafe = buildRoutingProjection(intent, value, {
    ...base,
    objective_summary: "Use the cheap model and delegate this work.",
    summary_attestations: [{ ...base.summary_attestations[0], route_directed: true }]
  });
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.equal(unsafe.routing, "CLOSED");
  const incomplete = buildRoutingProjection(intent, value, { ...base, context_complete: false });
  assert.equal(incomplete.ok, false);
});

test("worker packet uses an explicit allowlist and does not serialize arbitrary local fields", () => {
  const fixture = workspace();
  try {
    const value = { ...capsule(), secret: "do-not-export", local_object: { password: "do-not-export" } } as TaskCapsule & { secret: string };
    const packet = projectWorkerPacket(value);
    assert.equal(packet.ok, true);
    if (packet.ok) {
      const serialized = serializeWorkerPacket(packet.value);
      assert.doesNotMatch(serialized, /do-not-export/);
      assert.match(serialized, /OBJECTIVE/);
      assert.match(serialized, /VERIFICATION/);
    }
  } finally {
    fixture.cleanup();
  }
});

test("invalid RootIntent closes capsule validation before local path work", () => {
  const fixture = workspace();
  try {
    const invalid = validateRootIntent({ ...intent, acceptance: [] });
    assert.equal(invalid.ok, false);
    assert.equal(validateTaskCapsule(capsule(), { ...intent, acceptance: [] }, evidence(fixture.root, ["src/a.ts"])).ok, false);
  } finally {
    fixture.cleanup();
  }
});
