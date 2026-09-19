import type { HarnessConfig } from "./config.js";
import type { BenchTask, ModelUsage, QualityRecord } from "./harness.js";

const usage = (model: string, role: ModelUsage["role"], input: number, output: number, reasoning = 0): ModelUsage =>
  ({ model, role, input_tokens: input, output_tokens: output, reasoning_tokens: reasoning });
const passed = (): QualityRecord => ({ completed: true, acceptance_met: true, critical_defects: 0,
  human_interventions: 0, restores: 0, retries: 0 });

export const frozenConfig: HarnessConfig = {
  schema_revision: 1,
  harness_id: "jev-dry-run-1",
  frozen_at: 1_000_000,
  holdout_frozen: true,
  arms: { A: true, B: "unavailable", C: true },
  itt: true,
  ablations: ["full_policy", "without_review", "without_correction", "without_worker"],
  strata: ["small-edit", "root-choice", "security-review", "correction"],
  quality_endpoints: ["completion", "acceptance", "critical_defects", "restore_rate", "retry_rate"],
  quality_margins: { critical_defects: 0, min_completion: 1 },
  economics: {
    price_weights: {
      "gpt-6-astra": { input_per_million: 15, output_per_million: 60 },
      "gpt-5.6-terra": { input_per_million: 1, output_per_million: 4 },
      "jev-1.13.0": { input_per_million: 42, output_per_million: 0 }
    },
    flagship_models: ["gpt-6-astra"],
    margins: { weighted_cost: 0, flagship_consumption: 0 },
    z: 1.645
  },
  exclusion_rules: ["engineering_faults_documented_before_freeze"],
  max_retries_per_task: 1,
  sizing_evidence_digest: "bench-sizing-evidence-v1",
  statistical_plan_digest: "bench-statistical-plan-v1"
};

const noRisk = { persistent: true, public_interface: false, data_structure: false, security: false, permissions: false,
  judgment_calls: [] as string[], gaps: [] as string[] };

export const corpus: BenchTask[] = [
  {
    task_id: "t1-small-edit", stratum: "small-edit", root_intent_digest: "intent-t1",
    delegate: true, delegate_fails_once: false, review_required: false, risk: { ...noRisk },
    baseline: { "src/a.ts": "old" }, current: { "src/a.ts": "new" },
    owned_paths: ["src/a.ts"], acceptance_ids: ["a1"], command_id: "check-t1",
    arm_a_quality: passed(),
    arm_a_usage: [usage("gpt-6-astra", "root", 1000, 200, 500)],
    root_overhead_usage: [usage("gpt-6-astra", "root", 100, 20, 50)],
    jev_usage: [usage("jev-1.13.0", "jev", 400, 0)],
    worker_usage: [usage("gpt-5.6-terra", "worker", 800, 300)],
    reviewer_usage: []
  },
  {
    task_id: "t2-root-choice", stratum: "root-choice", root_intent_digest: "intent-t2",
    delegate: false, delegate_fails_once: false, review_required: false, risk: { ...noRisk },
    baseline: { "src/b.ts": "old" }, current: { "src/b.ts": "unchanged" },
    owned_paths: ["src/b.ts"], acceptance_ids: ["a2"], command_id: "check-t2",
    arm_a_quality: passed(),
    arm_a_usage: [usage("gpt-6-astra", "root", 800, 150, 400)],
    root_overhead_usage: [usage("gpt-6-astra", "root", 120, 30, 60)],
    jev_usage: [usage("jev-1.13.0", "jev", 300, 0)],
    worker_usage: [],
    reviewer_usage: []
  },
  {
    task_id: "t3-security-review", stratum: "security-review", root_intent_digest: "intent-t3",
    delegate: true, delegate_fails_once: false, review_required: true,
    risk: { ...noRisk, security: true },
    baseline: { "src/c.ts": "old" }, current: { "src/c.ts": "new" },
    owned_paths: ["src/c.ts"], acceptance_ids: ["a3"], command_id: "check-t3",
    arm_a_quality: passed(),
    arm_a_usage: [usage("gpt-6-astra", "root", 2000, 400, 800)],
    root_overhead_usage: [usage("gpt-6-astra", "root", 150, 30, 70)],
    jev_usage: [usage("jev-1.13.0", "jev", 500, 0)],
    worker_usage: [usage("gpt-5.6-terra", "worker", 900, 350)],
    reviewer_usage: [usage("gpt-6-astra", "reviewer", 600, 120, 200)]
  },
  {
    task_id: "t4-correction", stratum: "correction", root_intent_digest: "intent-t4",
    delegate: true, delegate_fails_once: true, review_required: false, risk: { ...noRisk },
    baseline: { "src/d.ts": "old" }, current: { "src/d.ts": "new" },
    owned_paths: ["src/d.ts"], acceptance_ids: ["a4"], command_id: "check-t4",
    arm_a_quality: passed(),
    arm_a_usage: [usage("gpt-6-astra", "root", 1500, 300, 600)],
    root_overhead_usage: [usage("gpt-6-astra", "root", 120, 20, 60)],
    jev_usage: [usage("jev-1.13.0", "jev", 400, 0)],
    worker_usage: [usage("gpt-5.6-terra", "worker", 700, 250)],
    reviewer_usage: []
  }
];
