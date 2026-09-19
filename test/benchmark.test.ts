import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { configErrors, priceWeightsDigest, type HarnessConfig } from "../bench/config.js";
import { corpus, frozenConfig } from "../bench/fixtures.js";
import { evaluate, runDryRun, BenchError, type DryRunReport } from "../bench/harness.js";

test("the frozen harness config carries no anti-p-hacking violations", () => {
  assert.deepEqual(configErrors(frozenConfig), []);
  const cases: Array<[string, (config: HarnessConfig) => void]> = [
    ["HOLDOUT_NOT_FROZEN", (config) => { config.holdout_frozen = false; }],
    ["ARM_B_UNDECLARED", (config) => { (config.arms as { B: string }).B = "maybe"; }],
    ["ITT_REQUIRED", (config) => { (config as { itt: boolean }).itt = false; }],
    ["PRICE_WEIGHTS_INVALID", (config) => { config.economics.price_weights = {}; }],
    ["FLAGSHIP_MODELS_UNDECLARED", (config) => { config.economics.flagship_models = []; }],
    ["STATISTICAL_PLAN_INVALID", (config) => { config.economics.z = 0; }],
    ["POST_HOC_EXCLUSION_FORBIDDEN", (config) => { config.exclusion_rules = ["drop failed or inconvenient tasks"]; }],
    ["STRATA_UNDECLARED", (config) => { config.strata = []; }],
    ["ABLATIONS_UNDECLARED", (config) => { config.ablations = ["without_worker"]; }]
  ];
  for (const [expected, mutate] of cases) {
    const config = structuredClone(frozenConfig);
    mutate(config);
    assert.ok(configErrors(config).includes(expected), expected);
  }
  assert.match(priceWeightsDigest(frozenConfig.economics.price_weights), /^[0-9a-f]{64}$/);
});

test("the deterministic dry-run exercises routing, guard, lifecycle and receipts without network", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("NETWORK_FORBIDDEN"); }) as typeof fetch;
  let first: DryRunReport;
  let second: DryRunReport;
  try {
    first = await runDryRun(frozenConfig, corpus);
    second = await runDryRun(frozenConfig, corpus);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(first.replay_digest, second.replay_digest);
  assert.equal(first.arms.A.tasks, corpus.length);
  assert.equal(first.arms.B.status, "unavailable");
  assert.equal(first.arms.C.tasks, corpus.length);
  assert.ok(first.arms.C.receipts >= corpus.length);
  for (const task of corpus) {
    assert.ok(first.assignments.some((assignment) => assignment.arm === "A" && assignment.task_id === task.task_id));
    assert.ok(first.assignments.some((assignment) => assignment.arm === "C" && assignment.task_id === task.task_id));
  }
  const byTask = new Map(first.assignments.filter((assignment) => assignment.arm === "C").map((assignment) => [assignment.task_id, assignment]));
  assert.equal(byTask.get("t1-small-edit")?.outcome, "accepted");
  assert.equal(byTask.get("t2-root-choice")?.outcome, "root_selected");
  assert.equal(byTask.get("t3-security-review")?.outcome, "accepted");
  assert.equal(byTask.get("t4-correction")?.outcome, "accepted");
  assert.equal(byTask.get("t4-correction")?.quality.retries, 1);
  assert.equal(byTask.get("t4-correction")?.quality.restores, 1);
  assert.equal(byTask.get("t1-small-edit")?.decision, "delegate");
});

test("quality gates economics, and weighted/flagship reduction can coexist with more raw tokens", async () => {
  const report = await runDryRun(frozenConfig, corpus);
  const evaluation = evaluate(report, frozenConfig);
  assert.equal(evaluation.quality_passed, true);
  assert.equal(evaluation.economics_evaluated, true);
  assert.equal(evaluation.qualification_eligible, false);
  assert.ok(evaluation.reasons.includes("DRY_RUN_ONLY"));
  assert.ok(evaluation.raw_total_tokens.arm_c > evaluation.raw_total_tokens.arm_a);
  assert.equal(evaluation.endpoints.weighted_cost.passed, true);
  assert.equal(evaluation.endpoints.flagship_consumption.passed, true);

  const regressed: DryRunReport = structuredClone(report);
  const cAssignment = regressed.assignments.find((assignment) => assignment.arm === "C")!;
  cAssignment.quality.critical_defects = 1;
  const failed = evaluate(regressed, frozenConfig);
  assert.equal(failed.quality_passed, false);
  assert.equal(failed.economics_evaluated, false);
  assert.equal(failed.endpoints.weighted_cost.passed, false);
  assert.ok(failed.reasons.includes("QUALITY_GATE_FAILED"));
});

test("diagnostic ablations are frozen, deterministic and never qualifiable", async () => {
  const withoutWorker = await runDryRun(frozenConfig, corpus, "without_worker");
  assert.equal(withoutWorker.ablation, "without_worker");
  const decisions = withoutWorker.assignments.filter((assignment) => assignment.arm === "C");
  assert.ok(decisions.every((assignment) => assignment.decision === "root"));
  const withoutCorrection = await runDryRun(frozenConfig, corpus, "without_correction");
  const corrected = withoutCorrection.assignments.find((assignment) => assignment.task_id === "t4-correction" && assignment.arm === "C");
  assert.equal(corrected?.outcome, "root_fallback");
  assert.equal(corrected?.quality.retries, 0);
  assert.ok(evaluate(withoutCorrection, frozenConfig).reasons.includes("ABLATION_NOT_QUALIFIABLE"));
  await assert.rejects(() => runDryRun(frozenConfig, corpus, "without_review_more" as "without_review"), /not frozen/);
});

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? sourceFiles(child) : [child];
  });
}

test("the harness is a separate observer the runtime never imports", () => {
  const root = process.cwd();
  for (const path of sourceFiles(join(root, "src"))) {
    if (!path.endsWith(".ts")) continue;
    assert.doesNotMatch(readFileSync(path, "utf8"), /bench\//, relative(root, path));
  }
});

test("the harness rejects unfrozen or incomplete experiment setups", async () => {
  const invalid = structuredClone(frozenConfig);
  invalid.exclusion_rules = ["drop timeouts"];
  await assert.rejects(() => runDryRun(invalid, corpus), BenchError);
  await assert.rejects(() => runDryRun(frozenConfig, []), /empty corpus/);
  await assert.rejects(() => runDryRun(frozenConfig, [corpus[0], corpus[0]]), /duplicate task IDs/);
  const undeclared = { ...corpus[0], task_id: "t9-other", stratum: "undeclared" };
  await assert.rejects(() => runDryRun(frozenConfig, [...corpus, undeclared]), /undeclared strata/);
});
