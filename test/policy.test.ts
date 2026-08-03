import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const skillRoot = join(repoRoot, "skills", "codex-auto-router");
const policyPath = join(skillRoot, "references", "routing-policy.md");
const packetPath = join(skillRoot, "references", "task-packet.md");
const lifecyclePath = join(skillRoot, "references", "native-subagent-lifecycle.md");
const skillPath = join(skillRoot, "SKILL.md");
const metadataPath = join(skillRoot, "agents", "openai.yaml");

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesUnder(child) : [child];
  });
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("the Policy is the sole canonical deep Module", () => {
  const declarations = filesUnder(skillRoot).filter((path) =>
    read(path).includes("sole canonical deep runtime Module")
  );

  assert.deepEqual(
    declarations.map((path) => relative(skillRoot, path)),
    ["references/routing-policy.md"]
  );
  assert.match(read(policyPath), /Policy version: `2\.1\.0`/);
});

test("metadata enables implicit consideration without duplicating policy state", () => {
  const policy = read(policyPath);
  const skill = read(skillPath);
  const metadata = read(metadataPath);

  assert.match(metadata, /allow_implicit_invocation: true/);
  assert.match(policy, /every Main Task is\s+automatically considered/i);
  assert.match(policy, /Consideration is not delegation/i);
  assert.match(skill, /shallow Adapter/);
  assert.doesNotMatch(skill, /ROOT_DIRECT|LUNA_XHIGH_BACKGROUND|TERRA_HIGH_BACKGROUND/);
  assert.doesNotMatch(metadata, /ROOT_DIRECT|LUNA_XHIGH_BACKGROUND|TERRA_HIGH_BACKGROUND/);
  assert.doesNotMatch(skill, /## (?:Route decisions|Failure behavior)/);
});

test("skill entrypoint is automatic and independent of optional Dashboard setup", () => {
  const skill = read(skillPath);

  assert.match(skill, /metadata hook is the automatic entry point/i);
  assert.match(skill, /considers the Main Task for native background execution/i);
  assert.match(skill, /without waiting\s+for a Dashboard or `npm run setup`/i);
  assert.match(skill, /keep the work in Root/i);
  assert.match(skill, /no executable router engine or Dashboard\s+dependency/i);
});

test("v2.1 route tuples, stand-down rules, gate, and break-even are explicit", () => {
  const policy = read(policyPath);

  for (const decision of ["ROOT_DIRECT", "LUNA_XHIGH_BACKGROUND", "TERRA_HIGH_BACKGROUND"]) {
    assert.match(policy, new RegExp("`" + decision + "`"));
  }
  assert.match(policy, /LUNA_XHIGH_BACKGROUND:\s+model: gpt-5\.6-luna\s+reasoning_effort: xhigh\s+fork_turns: none/);
  assert.match(policy, /TERRA_HIGH_BACKGROUND:\s+model: gpt-5\.6-terra\s+reasoning_effort: high\s+fork_turns: none/);
  assert.match(policy, /another active routing or orchestration authority governs/i);
  assert.match(policy, /active merge or rebase conflict/i);
  assert.match(policy, /ownership, scope, baseline, or restore state is ambiguous/i);

  for (const gate of [
    "substantial and bounded",
    "repository is safe",
    "Exact, mutually exclusive Worker-owned writable paths",
    "read-only unit declares its exact path and time/line window",
    "captured preflight baseline",
    "Fresh-context suitability",
    "Deterministic verification",
    "safely restored or discarded",
    "self-contained Task Packet",
    "positive break-even"
  ]) {
    assert.match(policy, new RegExp(gate, "i"));
  }
  assert.match(policy, /expected benefit > packet preparation \+ supervision\/review \+ likely recovery/);
  assert.match(policy, /strictly greater/i);
  assert.match(policy, /Missing,\s*incomparable,\s*or materially uncertain estimates[\s\S]*ROOT_DIRECT/s);
});

test("Luna is an exact allowlist and Terra owns other eligible bounded execution", () => {
  const policy = read(policyPath);

  assert.match(policy, /`READ_LOG_WINDOW`:[\s\S]*?declared log path[\s\S]*?time\/line\s+window[\s\S]*?timeline metrics or facts[\s\S]*?no writes and no broader judgment/i);
  assert.match(policy, /`WRITE_UNIT_TESTS`:[\s\S]*?declared test paths[\s\S]*?explicit test\s+names[\s\S]*?no production changes[\s\S]*?old and new\s+tests pass/i);
  assert.match(policy, /No other action is Luna-eligible/i);
  assert.match(policy, /Every other eligible bounded unit selects Terra/i);
  assert.match(policy, /at most one active child/i);
  assert.match(policy, /may not create descendants/i);
});

test("Task Packet contains complete scope, break-even, and specialized fields", () => {
  const packet = read(packetPath);
  for (const field of [
    "Route decision",
    "Selected native tuple",
    "Main objective",
    "Bounded responsibility",
    "Fresh-context suitability evidence",
    "Read:",
    "Write:",
    "Exact file ownership",
    "Do not touch:",
    "Captured preflight baseline",
    "Relevant facts",
    "User authorization and constraints",
    "Upstream Skill requirements",
    "Prohibitions and non-goals",
    "Required result",
    "Deterministic commands",
    "Expected verification results",
    "Safe restore/discard procedure",
    "Evidence to return"
  ]) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(packet, /Expected benefit/);
  assert.match(packet, /Packet preparation cost/);
  assert.match(packet, /Supervision\/review cost/);
  assert.match(packet, /Likely recovery cost/);
  assert.match(packet, /Total cost \(sum of the three costs above\)/);
  assert.match(packet, /strict comparison/i);
  assert.match(packet, /Missing, incomparable, or materially uncertain estimate/i);
  assert.match(packet, /READ_LOG_WINDOW/);
  assert.match(packet, /WRITE_UNIT_TESTS/);
  assert.match(packet, /Terra-after-Luna/);
  assert.match(packet, /resolved post-Luna baseline/i);
  assert.match(packet, /no unverified Luna changes/i);
});

test("lifecycle makes every child transition and writable-path resolution explicit", () => {
  const lifecycle = read(lifecyclePath);

  for (const heading of ["Prepare", "Create", "Collect and verify", "Focused repair", "Luna failure", "Close"]) {
    assert.match(lifecycle, new RegExp(`## \\d+\\. ${heading}`));
  }
  assert.match(lifecycle, /Root owns/);
  assert.match(lifecycle, /child owns/);
  assert.match(lifecycle, /Root must not edit those paths while the child is active/i);
  assert.match(lifecycle, /explicitly adopted or restored/i);
  assert.match(lifecycle, /No unresolved writable path may\s+remain/i);
  assert.match(lifecycle, /same child, retaining the same model,\s*effort, execution surface, and\s+fresh-context boundary/i);
  assert.match(lifecycle, /initial attempt plus at most two focused repair\s+follow-ups/i);
  assert.match(lifecycle, /exactly one fresh Terra child/i);
  assert.match(lifecycle, /no unverified Luna changes/i);
  assert.match(lifecycle, /static lifecycle documents the contract; it is not runtime\s+proof/i);
});

test("Root ownership, static-versus-runtime boundary, and Dashboard isolation align", () => {
  const policy = read(policyPath);
  const context = read(join(repoRoot, "CONTEXT.md"));
  const solution = read(join(repoRoot, "docs", "solution.md"));
  const dashboardBoundary = "Dashboard is an independent, read-only observer";

  for (const document of [policy, solution]) {
    assert.match(document, /Root (?:keeps|retains)\s+intent/i);
    assert.match(document, /Root\s+Model (?:never changes|does not change)/i);
    assert.match(document, new RegExp(dashboardBoundary));
  }
  assert.match(context, /Root Model/);
  assert.match(context, /Automatic routing never changes it/i);
  assert.match(context, new RegExp(dashboardBoundary));
  for (const term of ["Module", "Interface", "Seam", "Adapter", "Depth", "Locality"]) {
    assert.match(context, new RegExp(`\\b${term}\\b`));
  }
  assert.match(context, /Static contract/);
  assert.match(context, /Runtime proof/);
  assert.match(context, /current global `codex-orchestration` policy conflict blocks the v2\.1 pilot/i);
  assert.match(solution, /illustrative only/i);
  assert.match(solution, /cannot select a route or replace\s+the canonical Policy/i);
  assert.match(solution, /no global configuration edits/i);
});

test("prohibited executable routing artifacts and imports are absent", () => {
  const prohibitedPaths = [
    "src/router.ts",
    "src/classifier.ts",
    "src/registry.ts",
    "src/llm-router.ts",
    "src/telemetry.ts",
    "src/dashboard-control.ts"
  ];
  for (const path of prohibitedPaths) assert.equal(existsSync(join(repoRoot, path)), false, path);

  const sourceFiles = filesUnder(join(repoRoot, "src"));
  for (const path of sourceFiles) {
    const source = read(path);
    assert.doesNotMatch(source, /from ["'][^"']*(?:router|classifier|registry|llm-router|telemetry|dashboard-control)[^"']*["']/i, path);
    assert.doesNotMatch(source, /require\(["'][^"']*(?:router|classifier|registry|llm-router|telemetry|dashboard-control)[^"']*["']\)/i, path);
  }

  const packageJson = JSON.parse(read(join(repoRoot, "package.json"))) as {
    dependencies?: Record<string, string>;
  };
  assert.deepEqual(Object.keys(packageJson.dependencies ?? {}), ["ccusage"]);
});

test("route receipts stay commentary-only and are not durable routing state", () => {
  const policy = read(policyPath);
  assert.match(policy, /concise commentary receipt/i);
  assert.match(policy, /never\s+written to a file/i);
  assert.match(policy, /never\s+[\s\S]*sent to the Dashboard/i);
  assert.match(policy, /never\s+[\s\S]*read as input to a later Route\s+Decision/i);
});
