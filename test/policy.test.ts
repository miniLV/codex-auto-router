import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const skillRoot = join(repoRoot, "skills", "jev-auto-router");
const policyPath = join(skillRoot, "references", "routing-policy.md");
const skillPath = join(skillRoot, "SKILL.md");
const metadataPath = join(skillRoot, "agents", "openai.yaml");
const reviewerPath = join(skillRoot, "agents", "jev-auto-router-astra-reviewer.toml");
const installerPath = join(skillRoot, "scripts", "install-reviewer-agent.sh");
const packagePath = join(repoRoot, "package.json");
const pluginManifestPath = join(repoRoot, ".codex-plugin", "plugin.json");
const marketplacePath = join(repoRoot, ".agents", "plugins", "marketplace.json");

const canonicalDocPaths = [
  "spec.md",
  "CONTEXT.md",
  "docs/solution.md",
  "docs/sdd/README.md",
  "docs/sdd/architecture.md",
  "docs/sdd/task-capsule.md",
  "docs/sdd/capability-catalog.md",
  "docs/sdd/jev-adapter.md",
  "docs/sdd/route-plan.md",
  "docs/sdd/policy-guard.md",
  "docs/sdd/delivery-lifecycle.md",
  "docs/sdd/decision-receipt.md",
  "docs/sdd/benchmark.md",
  "README.md",
  "README.en.md"
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesUnder(child) : [child];
  });
}

function repoTextFiles(): string[] {
  return filesUnder(repoRoot).filter((path) =>
    /\.(?:md|ts|mjs|json|ya?ml|toml|sh)$/i.test(path) &&
    !/(?:^|\/)(?:node_modules|dist|\.git)(?:\/|$)/.test(path)
  );
}

test("the Policy is the sole canonical authority and carries no version pin", () => {
  const declarations = filesUnder(skillRoot).filter((path) =>
    read(path).includes("sole canonical authority")
  );
  assert.deepEqual(
    declarations.map((path) => relative(skillRoot, path)),
    ["references/routing-policy.md"]
  );
  assert.doesNotMatch(read(policyPath), /Policy version/);
});

test("no document exposes a specific contract version", () => {
  const versionMarkers = /v2\.3|v3\.0\.0|Policy version/i;
  const docPaths = [
    policyPath,
    skillPath,
    metadataPath,
    join(repoRoot, "CONTEXT.md"),
    join(repoRoot, "docs", "solution.md"),
    join(repoRoot, "docs", "adr", "README.md"),
    join(repoRoot, "README.md"),
    join(repoRoot, "README.en.md")
  ];
  for (const path of docPaths) {
    assert.doesNotMatch(read(path), versionMarkers, path);
  }
});

test("SKILL.md and metadata stay shallow Adapters", () => {
  const skill = read(skillPath);
  const metadata = read(metadataPath);
  assert.match(metadata, /allow_implicit_invocation: true/);
  assert.match(skill, /shallow Adapter/);
  assert.doesNotMatch(skill, /reasoning_effort:|fork_turns:|gpt-5\.6-(?:luna|terra)/);
  assert.doesNotMatch(metadata, /ROOT_DIRECT|gpt-5\.6-/);
});

test("SKILL.md links to the canonical Policy", () => {
  const policyLink = read(skillPath).match(/\[Runtime Router\s+Policy\]\(([^)]+)\)/);
  assert.ok(policyLink);
  assert.equal(policyLink[1], "references/routing-policy.md");
  assert.equal(existsSync(join(skillRoot, policyLink[1])), true);
});

test("ROOT_DIRECT is the first-class outcome and terminal state of every failure path", () => {
  const policy = read(policyPath);
  assert.match(policy, /`ROOT_DIRECT` is a first-class outcome, not a failure/);
  assert.match(
    policy,
    /missing,\s+ambiguous, or unverifiable resolves to `ROOT_DIRECT`/
  );
  assert.match(
    policy,
    /explicitly downgrades an unobservable signal to recorded residual risk/
  );
  assert.match(policy, /gpt-6-astra` or `gpt-5\.6-sol` at\s+`medium`, `high`, `xhigh`, `max`,\s+or `ultra`/);
  assert.match(policy, /A Skill cannot\s+change the Root model/);
});

test("Jev is the sole automatic selector and Root holds no shape heuristic", () => {
  const policy = read(policyPath);
  assert.match(policy, /Jev chooses\.\s+The Guard validates\.\s+Codex executes\.\s+Root verifies\./);
  assert.match(policy, /Jev is the only automatic route-selection intelligence/);
  assert.match(
    policy,
    /there is no\s+"single-file goes to a cheap lane, everything else goes to a bigger lane"\s+heuristic anywhere in this contract/
  );
  assert.match(policy, /\*\*Judgment work always stays in Root\*\*/);
  assert.match(policy, /authoring the Task Capsule and the dispatch specification itself/);
  // The fixed-lane selector is gone: no channel table, no delegated-by-default rule.
  assert.doesNotMatch(policy, /LUNA:|TERRA:/);
  assert.doesNotMatch(policy, /delegated by default/i);
  assert.doesNotMatch(policy, /Everything else eligible goes to Terra/);
  assert.doesNotMatch(policy, /Everything else eligible\b/);
});

test("the Task Capsule gate carries every template section, return field, and mechanical check", () => {
  const policy = read(policyPath);
  for (const section of [
    "OBJECTIVE",
    "FILES AND OWNERSHIP",
    "INTERFACES",
    "CONSTRAINTS",
    "VERIFICATION",
    "RETURN"
  ]) assert.match(policy, new RegExp(`^${section}$`, "m"), section);
  for (const field of ["STATUS:", "CHANGES:", "VERIFIED:", "JUDGMENT CALLS:", "GAPS:"])
    assert.match(policy, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), field);
  assert.match(policy, /A completion claim without evidence is invalid/);
  assert.match(policy, /Other work may land in this repository while you run/);
  assert.match(policy, /Keep changes made by\s+others intact/);
  assert.match(policy, /"Filled concretely" is not a judgment call/);
  assert.match(policy, /\*\*Every owned path resolves\.\*\*/);
  assert.match(policy, /No globs, no "the relevant files"/);
  assert.match(policy, /pairwise non-overlapping: no entry is a prefix of another/);
  assert.match(policy, /\*\*Every verification command has already been executed by Root\.\*\*/);
  assert.match(policy, /a section\s+with no executable command blocks the dispatch/);
  assert.match(policy, /\*\*The repository is safe and a baseline exists\.\*\*/);
  assert.match(policy, /either named concrete items or the\s+literal word `none`/);
  // The capsule is a bounded economic boundary.
  assert.match(policy, /\*\*economic boundary\*\*/);
  assert.match(policy, /must not copy the entire Root\s+conversation by default/);
  assert.match(policy, /the capsule may only narrow/);
});

test("the Capability Catalog is observed, truthful, and constrains Jev", () => {
  const policy = read(policyPath);
  assert.match(policy, /what the runtime can actually do \*\*now\*\*/);
  assert.match(policy, /`UNKNOWN` evidence means the\s+capability is \*\*absent\*\*/);
  assert.match(policy, /Discovery failures omit capabilities; they never fabricate them/);
  assert.match(policy, /Jev may select only entries present in this catalog/);
  assert.match(policy, /referencing\s+an absent or invented capability is invalid and the Guard denies it/);
  assert.match(policy, /There is\nno silent substitution/);
  assert.match(policy, /catalog digest is recorded in the Decision Receipt/);
});

test("Jev routing failures degrade to Root and never invent a route", () => {
  const policy = read(policyPath);
  assert.match(policy, /`decision: root` is a valid, first-class plan/);
  assert.match(policy, /UNAVAILABLE`/);
  assert.match(policy, /MALFORMED`/);
  assert.match(policy, /LOW_CONFIDENCE`/);
  assert.match(
    policy,
    /Every adapter failure state except CANCELLED means automatic delegation is\s+unavailable and resolves to `ROOT_DIRECT`; CANCELLED stops without takeover/
  );
  assert.match(
    policy,
    /There is no heuristic fallback route, no legacy\s+lane table, and no second selector anywhere in this contract/
  );
  assert.match(policy, /never an invented\s+token or dollar forecast/);
  assert.match(policy, /V1 uses exactly one Choice over complete candidate IDs/);
  assert.match(policy, /No Score\/Noul,/);
  assert.match(policy, /Pin jev-1\.13\.0 and check every response/);
});

test("the Policy Guard has unconditional veto and zero alternate-routing authority", () => {
  const policy = read(policyPath);
  assert.match(policy, /holds unconditional\s+veto authority with \*\*no alternate-routing authority\*\*/);
  assert.match(policy, /never selects,\nsubstitutes, or downgrades a plan/);
  assert.match(policy, /ALLOW\(RoutePlan\)\s+— execute exactly the plan/);
  assert.match(policy, /DENY\(reason\) → Root/);
  assert.match(policy, /A `DENY` never produces a modified plan/);
  for (const check of [
    "the RoutePlan schema is valid",
    "route confidence meets the frozen requirement",
    "the requested model supports the requested reasoning effort",
    "task ownership is bounded",
    "user authorization covers the action class and side-effect class",
    "every writable target has a recoverable baseline",
    "the permission set is least-privilege enough",
    "no forbidden child delegation or fan-out",
    "the benchmark profile permits automatic routing for this task shape",
    "the attempt budget remains",
    "the review budget remains",
    "genuinely observable"
  ]) assert.match(policy, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), check);
  assert.match(policy, /frozen per benchmark release/);
  assert.match(policy, /never tuned per\s+task at runtime/);
  assert.match(
    policy,
    /Until a task profile holds frozen benchmark qualification, check 13 fails for\s+it by default/
  );
});

test("the execution contract distinguishes safety failure from attribution taint", () => {
  const policy = read(policyPath);
  for (const state of [
    "requested_match",
    "requested_mismatch",
    "routing_metadata_unobservable",
    "accepted_under_unobservable",
    "permission_scope_violation",
    "context_boundary_violation"
  ]) assert.match(policy, new RegExp(state), state);
  assert.match(policy, /\*\*UNKNOWN is never MATCH\.\*\*/);
  assert.match(policy, /Artifact correctness is separate from route\/cost attribution/);
  assert.match(policy, /excluded from verified-savings evidence/);
  assert.match(policy, /stronger safety failure/);
  assert.match(
    policy,
    /restore the\s+baseline when necessary, stop automatic delegation for this task/
  );
  assert.match(policy, /Record the unverified dimensions as residual risk/);
  assert.match(policy, /adopt at most once under `accepted_under_unobservable`/);
});

test("mechanical verification cannot be skipped or self-reported", () => {
  const policy = read(policyPath);
  assert.match(policy, /A child's own report of success proves nothing by itself/);
  assert.match(
    policy,
    /Rerun in Root every verification command whose inputs the child's owned\s+paths could affect/
  );
  assert.match(policy, /reuse the result\s+recorded at the capsule gate/);
  assert.match(
    policy,
    /cannot be skipped, delegated, or satisfied by self-report/
  );
});

test("semantic review is risk triggered, isolation is observed, and verdicts are voidable", () => {
  const policy = read(policyPath);
  assert.match(policy, /Run \*\*at most one\*\* semantic review for each candidate/);
  assert.match(policy, /public interface, data structure, permission, or security path/);
  assert.match(policy, /non-empty `JUDGMENT CALLS` or `GAPS`/);
  assert.match(policy, /Spanning multiple files is not a trigger by itself/);
  assert.match(policy, /REVIEWER:\s+model: gpt-6-astra\s+reasoning_effort: medium\s+fork_turns: none/);
  assert.match(
    policy,
    /whether the objective\s+and constraints themselves were adequate for the stated outcome/
  );
  assert.match(policy, /`ACCEPT`, `REVISE`, or `RECONSIDER`/);
  assert.match(policy, /No finding ledger or stable\s+identifiers are required/);
  assert.match(policy, /Isolation is observed, never assumed/);
  assert.match(policy, /ENFORCED_READ_ONLY/);
  assert.match(policy, /BEHAVIORALLY_READ_ONLY/);
  assert.match(policy, /REVIEW_UNAVAILABLE/);
  assert.match(policy, /Never describe this tier as enforced read-only/);
  assert.match(policy, /Stop the\s+lane; do not hide or repair a mutation under the verdict/);
  assert.match(policy, /Any change made after a verdict voids that verdict/);
  assert.match(policy, /A corrected candidate is\na new candidate/);
  assert.match(
    policy,
    /Neither the profile, its installer, nor its `--check` proves that a reviewer\s+was spawned/
  );
  assert.match(policy, /agents\/jev-auto-router-astra-reviewer\.toml/);
});

test("correction is evidence-driven, continuation is proven or absent, and budgets are bounded", () => {
  const policy = read(policyPath);
  assert.match(policy, /restore the baseline first/);
  assert.match(policy, /structured failure evidence/);
  assert.match(policy, /`continue_same_worker`/);
  assert.match(policy, /never resend the same\s+instructions/);
  assert.match(policy, /never silently repair the child's patch/);
  assert.match(
    policy,
    /\*\*Same-worker continuation is permitted only when runtime evidence proves\*\*/
  );
  assert.match(
    policy,
    /a valid continuation handle, worker identity matching the original,\s+unchanged ownership, and a re-confirmable model\/runtime contract/
  );
  assert.match(policy, /it is unavailable to Jev/);
  assert.match(policy, /hard worker execution ceiling: \*\*3\*\*/);
  assert.match(policy, /normal automatic economic ceiling: \*\*2\*\*/);
  assert.match(policy, /a \*\*third\*\* execution requires explicit benchmark qualification/);
  assert.match(policy, /The safety budget is not consumed merely because it\s+exists/);
  assert.match(policy, /the same verification command failing twice/);
  assert.match(policy, /scope thrash/);
  assert.match(policy, /execution identity becoming uncertain/);
  assert.match(policy, /Exactly one child runs at a time/);
  assert.match(policy, /A child may not create descendants/);
  assert.match(
    policy,
    /`RECONSIDER` → stop, return to Root architecture and judgment, and consult\s+the user/
  );
});

test("usage and credit data are barred from routing; receipts are evidence, not authority", () => {
  const policy = read(policyPath);
  assert.match(
    policy,
    /Dashboard, `ccusage`, `src\/credit\.ts`, Credit or usage estimates, account\nquota, model mix, historical token share, and latency are never inputs/
  );
  assert.match(policy, /Elapsed time may be a user-facing constraint but never a\s+routing input/);
  assert.match(policy, /\*\*Decision Receipt\*\*/);
  assert.match(policy, /evidence,\nnever routing authority/);
  assert.match(policy, /nothing reads a receipt to decide a future route/);
  assert.match(policy, /Normal routing state is ephemeral/);
  assert.match(policy, /A new stateless session cannot know a prior one/);
  assert.match(policy, /stands down to `ROOT_DIRECT`/);
});

test("the policy states its own design rationale", () => {
  const policy = read(policyPath);
  assert.match(policy, /## 13\. Design rationale/);
  for (const point of [
    "Jev is the sole selector",
    "The Guard validates and never chooses",
    "The catalog constrains selection",
    "The capsule is bounded",
    "Every writable path gets a baseline before dispatch",
    "Requested versus observed is explicit",
    "Mechanical verification and semantic review are distinct",
    "Economics are benchmark-qualified",
    "Usage, credit, and Dashboard data are barred"
  ]) assert.match(policy, new RegExp(point.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), point);
});

test("no file names or links to another project inside the Skill", () => {
  const thirdPartyMarkers = /sol-advisor|zhijian|DannyMac180|BillionsBobby|SOURCE\.json|NOTICE\.md/i;
  for (const path of filesUnder(skillRoot)) {
    assert.doesNotMatch(read(path), thirdPartyMarkers, path);
  }
  for (const path of [
    "skills/jev-auto-router/SOURCE.json",
    "skills/jev-auto-router/NOTICE.md",
    "skills/jev-auto-router/SOL-ADVISOR-MIT-LICENSE",
    "skills/jev-auto-router/UPSTREAM-MIT-LICENSE"
  ]) assert.equal(existsSync(join(repoRoot, path)), false, path);
});

test("the optional reviewer profile and installer survive intact under the new identity", () => {
  assert.equal(existsSync(reviewerPath), true);
  assert.equal(existsSync(installerPath), true);
  const reviewer = read(reviewerPath);
  assert.match(reviewer, /^name = "jev_auto_router_astra_reviewer"$/m);
  assert.match(reviewer, /^model = "gpt-6-astra"$/m);
  assert.match(reviewer, /^model_reasoning_effort = "medium"$/m);
  assert.match(reviewer, /^sandbox_mode = "read-only"$/m);
  assert.match(reviewer, /ACCEPT, REVISE, or RECONSIDER/);
  assert.match(reviewer, /adequate for the stated outcome/);
  assert.doesNotMatch(
    reviewer,
    /DELIVERABLE|CORRECTION_REQUIRED|ARCHITECTURAL_RECONSIDERATION|anchored|finding history/i
  );
  const installer = read(installerPath);
  assert.match(installer, /jev-auto-router-astra-reviewer\.toml/);
  assert.match(installer, /refusing to overwrite it/i);
});

test("removed over-engineered artifacts stay removed", () => {
  for (const path of [
    "skills/jev-auto-router/references/task-packet.md",
    "skills/jev-auto-router/references/native-subagent-lifecycle.md",
    "skills/jev-auto-router/scripts/inspect-reviewer-runtime.sh",
    "docs/diagrams/auto-routing-en.html",
    "docs/diagrams/auto-routing-en.png",
    "docs/diagrams/auto-routing-zh.html",
    "docs/diagrams/auto-routing-zh.png"
  ]) assert.equal(existsSync(join(repoRoot, path)), false, path);

  const policy = read(policyPath);
  for (const term of [
    "Delivery Budget",
    "review_anchor_digest",
    "Persistent-change Candidate",
    "ARCHITECTURAL_RECONSIDERATION"
  ]) assert.doesNotMatch(policy, new RegExp(term, "i"), term);
  // A finding ledger may only appear as an explicit non-requirement.
  assert.deepEqual(policy.match(/finding ledger/gi), ["finding ledger"]);
  assert.match(policy, /No finding ledger or stable\s+identifiers are required/);
});

test("prohibited executable routing artifacts remain absent", () => {
  for (const path of [
    "src/router.ts",
    "src/classifier.ts",
    "src/registry.ts",
    "src/llm-router.ts",
    "src/telemetry.ts",
    "src/dashboard-control.ts",
    "src/heuristic-router.ts",
    "src/openai-router.ts",
    "src/rule-router.ts"
  ]) assert.equal(existsSync(join(repoRoot, path)), false, path);
  for (const path of filesUnder(join(repoRoot, "src"))) {
    assert.doesNotMatch(
      read(path),
      /from ["'][^"']*(?:router|classifier|registry|llm-router|telemetry|dashboard-control)[^"']*["']/i,
      path
    );
  }
});

test("the plugin manifest version never drifts from the package version", () => {
  const manifest = JSON.parse(read(packagePath)) as { version: string };
  const pluginManifest = JSON.parse(read(pluginManifestPath)) as { version: string };
  assert.equal(pluginManifest.version, manifest.version);
});

test("the credit dashboard is retained and its dependency stays pinned", () => {
  const manifest = JSON.parse(read(packagePath)) as { dependencies?: Record<string, string> };
  assert.deepEqual(manifest.dependencies, { ccusage: "20.0.19" });
  assert.equal(existsSync(join(repoRoot, "src", "credit.ts")), true);
  assert.equal(existsSync(join(repoRoot, "src", "server.ts")), true);
});

test("canonical identity is jev-auto-router everywhere it is declared", () => {
  const pkg = JSON.parse(read(packagePath)) as { name: string };
  const plugin = JSON.parse(read(pluginManifestPath)) as {
    name: string;
    interface: { displayName: string };
    repository: string;
    homepage: string;
  };
  const marketplace = JSON.parse(read(marketplacePath)) as {
    name: string;
    interface: { displayName: string };
    plugins: { name: string; source: { url: string } }[];
  };
  assert.equal(pkg.name, "jev-auto-router");
  assert.equal(plugin.name, "jev-auto-router");
  assert.equal(plugin.interface.displayName, "Jev Auto Router");
  assert.equal(plugin.repository, "https://github.com/miniLV/jev-auto-router");
  assert.equal(plugin.homepage, "https://github.com/miniLV/jev-auto-router");
  assert.equal(marketplace.name, "jev-auto-router");
  assert.equal(marketplace.interface.displayName, "Jev Auto Router");
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, "jev-auto-router");
  assert.equal(marketplace.plugins[0].source.url, "https://github.com/miniLV/jev-auto-router.git");
  assert.equal(existsSync(join(repoRoot, "skills", "jev-auto-router", "SKILL.md")), true);
  assert.equal(existsSync(join(repoRoot, "skills", "codex-auto-router")), false);
  assert.match(read(skillPath), /^name: jev-auto-router$/m);
  for (const readme of ["README.md", "README.en.md"]) {
    assert.match(read(join(repoRoot, readme)), /github\.com\/miniLV\/jev-auto-router"/, readme);
  }
  for (const script of ["scripts/release.mjs", "scripts/verify-release-version.mjs"]) {
    assert.match(read(join(repoRoot, script)), /jev-auto-router/, script);
    assert.doesNotMatch(read(join(repoRoot, script)), /codex-auto-router/, script);
  }
});

test("the old identity survives only as recorded history or migration text", () => {
  const allowedHistorical = new Set([
    "README.md",
    "README.en.md",
    "docs/solution.md",
    "spec.md",
    "plan.md",
    "task.md"
  ]);
  const stale = /codex-auto-router|Codex Auto Router|codex_auto_router/i;
  const staleGlobal = /codex-auto-router|Codex Auto Router|codex_auto_router/ig;
  for (const path of repoTextFiles()) {
    const rel = relative(repoRoot, path);
    if (rel === join("test", "policy.test.ts")) continue;
    if (allowedHistorical.has(rel)) continue;
    assert.doesNotMatch(read(path), stale, rel);
  }
  // Exact per-file allowances derived from intent, not a blanket constant:
  // README ×2 per language (rename note + v0.2.0 migration/upgrade bullet);
  // solution/spec ×1 history sentence each; plan ×3 migration runbook;
  // task ×4 migration status + sweep list.
  const expected = new Map([
    ["README.md", 2],
    ["README.en.md", 2],
    ["docs/solution.md", 1],
    ["spec.md", 1],
    ["plan.md", 3],
    ["task.md", 4]
  ]);
  for (const [rel, count] of expected) {
    const occurrences = [...read(join(repoRoot, rel)).matchAll(staleGlobal)].length;
    assert.equal(
      occurrences,
      count,
      `${rel} carries ${occurrences} old-identity mentions; expected exactly ${count} historical/migration uses`
    );
  }
});

test("no superseded architecture conclusion survives in the canonical documents", () => {
  const staleConclusions =
    /Jev is advisory|advisory[- ]only|not a core component|experiment[- ]only|Jev experiment|Jev cannot select|should be deferred|delegated by default|Everything else eligible|goes to Terra|fixed child tuples|LUNA:|TERRA:/i;
  const docPaths = [
    ...canonicalDocPaths.map((rel) => join(repoRoot, rel)),
    policyPath,
    skillPath,
    metadataPath,
    reviewerPath,
    installerPath
  ];
  for (const path of docPaths) {
    assert.doesNotMatch(read(path), staleConclusions, relative(repoRoot, path));
  }
});

test("the benefit boundary stays benchmark-qualified and no savings are pre-claimed", () => {
  const forbiddenClaims =
    /automatically saves tokens|always saves quota|cheaper by design|guarantees the optimal model|lower[s]? cost automatically/i;
  // User-facing claim surfaces only; spec.md/task.md legitimately define the
  // forbidden-claims and stale-term lists themselves.
  const claimSurfaces = [
    "README.md",
    "README.en.md",
    "CONTEXT.md",
    "docs/solution.md",
    "docs/sdd/README.md",
    "docs/sdd/architecture.md",
    "docs/sdd/benchmark.md"
  ];
  for (const rel of claimSurfaces) {
    assert.doesNotMatch(read(join(repoRoot, rel)), forbiddenClaims, rel);
  }
  const spec = read(join(repoRoot, "spec.md"));
  assert.match(spec, /Quality non-inferiority passes before any economics is evaluated/);
  assert.match(spec, /End-to-end economic savings remain benchmark-dependent/);
  const policy = read(policyPath);
  assert.match(
    policy,
    /safety eligibility is not an economic claim/
  );
});

test("ADR 0014 invariants: unit-scoped closure, deterministic projection, probe-first execution, one Choice", () => {
  const spec = read(join(repoRoot, "spec.md"));
  const lifecycle = read(join(repoRoot, "docs", "sdd", "delivery-lifecycle.md"));
  const capsule = read(join(repoRoot, "docs", "sdd", "task-capsule.md"));
  const planDoc = read(join(repoRoot, "plan.md"));
  const taskDoc = read(join(repoRoot, "task.md"));
  const task8 = taskDoc.slice(taskDoc.indexOf("## Task 8"), taskDoc.indexOf("## Task 9"));

  // Two-layer routing state and the main-task latch list.
  assert.match(spec, /MainTaskRoutingState/);
  assert.match(spec, /TaskUnitRoutingState/);
  assert.match(spec, /close the current unit's automatic routing only/);
  for (const latch of [
    "safety or\npermission-scope violation",
    "counter\ncorruption",
    "competing routing authority",
    "authorization\nambiguity",
    "global worker-execution budget",
    "invalidated\nhost trust"
  ]) assert.match(spec, new RegExp(latch), latch);
  assert.match(lifecycle, /Latch Main Task/);
  assert.match(lifecycle, /2 per task unit/);

  // Economics objective: weighted cost / flagship consumption primary, raw tokens secondary.
  assert.match(spec, /frozen-price-weighted delivery cost and frontier-capacity\nconsumption/);
  assert.match(spec, /Raw cross-model token totals are \*\*not\*\* the primary objective/);
  assert.match(read(join(repoRoot, "docs", "sdd", "benchmark.md")), /Primary endpoints \(only after quality passes\)/);
  assert.match(read(join(repoRoot, "docs", "sdd", "benchmark.md")), /price_weights_digest/);

  // Deterministic projection: fact-derived traits and banned route-directed vocabulary.
  for (const trait of [
    "owned_file_count_bucket",
    "changed_language",
    "public_interface_touched",
    "verification_count",
    "context_size_bucket"
  ]) assert.match(capsule, new RegExp(trait), trait);
  assert.match(capsule, /deterministic, fact-derived ONLY/);
  assert.match(capsule, /Banned from authored semantic recommendations/);
  assert.match(capsule, /route-directed\s+recommendations/);
  assert.match(capsule, /literal identifiers|Literal identifiers/);

  // Probe-first execution gate.
  assert.match(spec, /probe_read_only/);
  assert.match(spec, /unconstructible/);
  const task11 = taskDoc.slice(taskDoc.indexOf("## Task 11"), taskDoc.indexOf("## Task 12"));
  assert.match(task11, /read-only probes only/);
  assert.match(task11, /No writable child may exist in P3/);

  // V1 is exactly one Choice everywhere an implementer might look.
  assert.match(planDoc, /exactly one Choice\nquestion over complete candidate IDs/);
  assert.match(task8, /exactly one Choice/);
  assert.doesNotMatch(task8, /Score|Noul/);

  // Discovery evidence ladder.
  const task10 = taskDoc.slice(taskDoc.indexOf("## Task 10"), taskDoc.indexOf("## Task 11"));
  for (const level of ["DISCOVERED", "REQUESTABLE", "ENFORCEABLE", "APPLIED"]) {
    assert.match(task10, new RegExp(`\\*\\*${level}\\*\\*`), level);
  }
  assert.match(task10, /DISCOVERED alone never enters the candidate set/);

  // ADR 0014 exists and is referenced by the spec.
  assert.equal(existsSync(join(repoRoot, "docs", "adr", "0014-quality-constrained-jev-delivery.md")), true);
  assert.match(spec, /0014-quality-constrained-jev-delivery\.md/);
});

test("READMEs present the runtime as architecture preview, not a shipped product", () => {
  assert.match(read(join(repoRoot, "README.md")), /架构预览/);
  assert.match(read(join(repoRoot, "README.en.md")), /architecture preview/);
  assert.doesNotMatch(read(join(repoRoot, "README.md")), /到这里就可以用了/);
  assert.doesNotMatch(read(join(repoRoot, "README.en.md")), /That is the whole setup/);
});
