import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const skillRoot = join(repoRoot, "skills", "codex-auto-router");
const policyPath = join(skillRoot, "references", "routing-policy.md");
const skillPath = join(skillRoot, "SKILL.md");
const metadataPath = join(skillRoot, "agents", "openai.yaml");
const reviewerPath = join(skillRoot, "agents", "codex-auto-router-astra-reviewer.toml");
const installerPath = join(skillRoot, "scripts", "install-reviewer-agent.sh");
const packagePath = join(repoRoot, "package.json");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesUnder(child) : [child];
  });
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

test("ROOT_DIRECT is the terminal state of every failure path", () => {
  const policy = read(policyPath);
  assert.match(policy, /`ROOT_DIRECT` is not a route chosen for economy/);
  assert.match(
    policy,
    /missing,\s+ambiguous, or unverifiable resolves to `ROOT_DIRECT`/
  );
  assert.match(
    policy,
    /explicitly downgrades an unobservable signal to recorded residual risk/
  );
  assert.match(policy, /gpt-6-astra` at `medium`, `high`, `xhigh`, `max`, or `ultra`/);
  assert.match(policy, /A Skill cannot change the\s+Root model/);
});

test("channel tuples are exact and every child gets a fresh context", () => {
  const policy = read(policyPath);
  assert.match(policy, /LUNA:\s+model: gpt-5\.6-luna\s+reasoning_effort: xhigh\s+fork_turns: none/);
  assert.match(policy, /TERRA:\s+model: gpt-5\.6-terra\s+reasoning_effort: high\s+fork_turns: none/);
  assert.match(policy, /REVIEWER:\s+model: gpt-6-astra\s+reasoning_effort: medium\s+fork_turns: none/);
  assert.match(policy, /Exactly one child per Main Task at a time/);
  assert.match(policy, /may not create descendants/);
  assert.match(policy, /Never substitute another model, effort,\s+or context boundary/);
});

test("classification is by nature, never by difficulty", () => {
  const policy = read(policyPath);
  assert.match(policy, /\*\*Judgment work always stays in Root\*\*/);
  assert.match(policy, /\*\*writing the dispatch specification itself\*\*/);
  assert.match(policy, /Do not vary the channel by perceived difficulty/);
  assert.match(policy, /\*\*Implementation work is delegated by default\*\*/);
});

test("the dispatch template carries every required section and return field", () => {
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
});

test("the gate is three mechanical checks with no cost or size floor", () => {
  const policy = read(policyPath);
  assert.match(policy, /"Filled concretely" is not a judgment call/);
  assert.match(policy, /\*\*Every owned path resolves\.\*\*/);
  assert.match(policy, /No globs, no "the relevant files"/);
  assert.match(policy, /pairwise non-overlapping: no entry is a prefix of another/);
  assert.match(policy, /\*\*Every verification command has already been executed by Root\.\*\*/);
  assert.match(policy, /a section\s+with no executable command blocks the dispatch/);
  assert.match(policy, /\*\*The repository is safe and a baseline exists\.\*\*/);
  assert.match(policy, /either named concrete items or the\s+literal word `none`/);
  assert.match(policy, /No size or cost floor gates delegation in this version/);
  assert.doesNotMatch(policy, /Expected Sol Work Reduction|break-even/i);
  assert.doesNotMatch(policy, /at no extra cost/);
});

test("Luna is gated by verifiable shape, not by judgement", () => {
  const policy = read(policyPath);
  assert.match(policy, /\*\*read-only evidence\*\*: an exact path plus an exact line or time window/);
  assert.match(policy, /\*\*bounded write\*\*: a single file, or same-directory files of the same kind/);
  assert.match(policy, /no change to a public interface, configuration, or dependency/);
  assert.match(policy, /verification is one command with a binary result/);
  assert.match(policy, /Everything else eligible goes to Terra/);
});

test("a reported tuple mismatch rejects output, an unobservable tuple does not", () => {
  const policy = read(policyPath);
  assert.match(policy, /Requesting a tuple does not prove it was applied/);
  assert.match(policy, /\*\*Observed and mismatched\*\*/);
  assert.match(policy, /Do not accept the output: restore the baseline and\s+choose `ROOT_DIRECT`/);
  assert.match(policy, /\*\*Unobservable on this host\*\*/);
  assert.match(policy, /Do not discard the output for that reason alone/);
  assert.match(policy, /record the unverified tuple as residual risk/);
  assert.match(policy, /Discarding paid-for output because the host cannot label it/);
});

test("mechanical verification cannot be skipped or self-reported", () => {
  const policy = read(policyPath);
  assert.match(policy, /A child's own report of success proves nothing by itself/);
  assert.match(
    policy,
    /Rerun in Root every verification command whose inputs the child's owned\s+paths could affect/
  );
  assert.match(policy, /reuse the result\s+recorded at the dispatch gate/);
  assert.match(
    policy,
    /cannot be skipped, delegated, or satisfied by self-report/
  );
});

test("semantic review is risk triggered, candidate-scoped, and skipping it never counts as review", () => {
  const policy = read(policyPath);
  assert.match(policy, /Root wrote both the\s+specification and the verification commands/);
  assert.match(policy, /at most one\*\* semantic review for each candidate/);
  assert.match(policy, /at most five semantic\s+reviews, one for each of its at most five candidates/);
  assert.match(policy, /Spanning multiple files is not a trigger by itself/);
  assert.doesNotMatch(policy, /- it spans multiple files/);
  assert.match(policy, /public interface, data structure, permission, or security path/);
  assert.match(policy, /non-empty `JUDGMENT CALLS` or `GAPS`/);
  assert.match(
    policy,
    /whether the objective\s+and constraints themselves were adequate for the stated outcome/
  );
  assert.match(
    policy,
    /Skipping review under these rules is not a\s+claim that the change was reviewed/
  );
  assert.match(policy, /`ACCEPT`, `REVISE`, or `RECONSIDER`/);
  assert.match(policy, /No finding ledger or stable identifiers\s+are required/);
  assert.match(policy, /Any change made after a verdict voids that verdict/);
});

test("reviewer creation offers an optional profile without ever claiming isolation", () => {
  const policy = read(policyPath);
  assert.match(policy, /Isolation is observed, never assumed/);
  assert.match(policy, /\*\*Named profile, when available\.\*\*/);
  assert.match(policy, /This path is optional hardening, not a prerequisite/);
  assert.match(policy, /\*\*Per-spawn parameters, always available\.\*\*/);
  assert.match(
    policy,
    /Neither the profile, its installer, nor its `--check` proves that a reviewer was\s+spawned/
  );
  assert.match(
    policy,
    /Never describe the review as\s+enforced read-only unless the observed sandbox policy type is exactly\s+`read-only`/
  );
  assert.match(policy, /do not hide or repair it\s+under the verdict/);
});

test("retry state machine gives each corrected candidate an independent review within five attempts", () => {
  const policy = read(policyPath);
  assert.match(policy, /A corrected candidate is a\s+new candidate/);
  assert.match(policy, /reviewed independently within the remaining task budget/);
  assert.match(policy, /before the fifth dispatch/);
  assert.match(policy, /on the fifth dispatch/);
  assert.match(policy, /At most five dispatches per Main Task/);
  assert.match(policy, /up to four corrected\s+retries/);
  assert.match(policy, /A candidate receives at most one semantic review, and the task may\s+run at most five semantic reviews total/);
  assert.match(policy, /Failed, timed-out, unverifiable, and rejected dispatches all count/);
  assert.match(policy, /Its\s+specification must differ from\s+the one that failed/);
  assert.match(policy, /Never\s+silently repair the child's\s+patch/);
  assert.match(policy, /a\s+fresh\s+candidate starting from the restored baseline,\s+not a resumed one/);
  assert.match(policy, /needs no\s+same-child follow-up capability/);
  assert.match(
    policy,
    /Restoring a candidate and continuing in Root is not termination of the user's\s+goal/
  );
  assert.match(policy, /reviewer and worker never run at the same time|Reviewer and worker never run at the same time/i);
});

test("usage and credit data are barred from routing, and notes stay commentary", () => {
  const policy = read(policyPath);
  assert.match(
    policy,
    /Dashboard, `ccusage`, `src\/credit\.ts`, Credit or usage estimates, model mix,\s+historical token share, and latency are never inputs/
  );
  assert.match(policy, /Elapsed time may be a\s+user-facing constraint but never a routing input/);
  assert.match(policy, /Route notes are commentary/);
  assert.match(policy, /a new stateless session\s+cannot know a prior one/);
});

test("no file names or links to another project", () => {
  const thirdPartyMarkers = /sol-advisor|zhijian|DannyMac180|zjp1997720|SOURCE\.json|NOTICE\.md/i;
  for (const path of filesUnder(skillRoot)) {
    assert.doesNotMatch(read(path), thirdPartyMarkers, path);
  }
  for (const path of [
    "skills/codex-auto-router/SOURCE.json",
    "skills/codex-auto-router/NOTICE.md",
    "skills/codex-auto-router/SOL-ADVISOR-MIT-LICENSE",
    "skills/codex-auto-router/UPSTREAM-MIT-LICENSE",
    "docs/research/sol-advisor-reviewer-runtime.md"
  ]) assert.equal(existsSync(join(repoRoot, path)), false, path);
});

test("the policy states its own design rationale without naming another project", () => {
  const policy = read(policyPath);
  assert.match(policy, /## 11\. Design rationale/);
  for (const point of [
    "A cheaper channel is selected by verifiable task shape",
    "Every writable path gets a baseline before dispatch",
    "The dispatch limit is five per Main Task",
    "Semantic review is triggered by risk",
    "Exactly one child runs at a time",
    "Every failure path resolves to `ROOT_DIRECT`",
    "Usage, credit, and Dashboard data are barred"
  ]) assert.match(policy, new RegExp(point.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), point);
});

test("the optional reviewer profile and installer survive intact", () => {
  assert.equal(existsSync(reviewerPath), true);
  assert.equal(existsSync(installerPath), true);
  const reviewer = read(reviewerPath);
  assert.match(reviewer, /^name = "codex_auto_router_astra_reviewer"$/m);
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
  assert.match(installer, /matches the bundled profile byte for byte/);
  assert.match(installer, /refusing to overwrite it/i);
});

test("removed over-engineered artifacts stay removed", () => {
  for (const path of [
    "skills/codex-auto-router/references/task-packet.md",
    "skills/codex-auto-router/references/native-subagent-lifecycle.md",
    "skills/codex-auto-router/scripts/inspect-reviewer-runtime.sh"
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
  assert.match(policy, /No finding ledger or stable identifiers\s+are required/);
});

test("prohibited executable routing artifacts remain absent", () => {
  for (const path of [
    "src/router.ts",
    "src/classifier.ts",
    "src/registry.ts",
    "src/llm-router.ts",
    "src/telemetry.ts",
    "src/dashboard-control.ts"
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
  const pluginManifest = JSON.parse(
    read(join(repoRoot, ".codex-plugin", "plugin.json"))
  ) as { version: string };
  assert.equal(pluginManifest.version, manifest.version);
});

test("the credit dashboard is retained and its dependency stays pinned", () => {
  const manifest = JSON.parse(read(packagePath)) as { dependencies?: Record<string, string> };
  assert.deepEqual(manifest.dependencies, { ccusage: "20.0.19" });
  assert.equal(existsSync(join(repoRoot, "src", "credit.ts")), true);
  assert.equal(existsSync(join(repoRoot, "src", "server.ts")), true);
});
