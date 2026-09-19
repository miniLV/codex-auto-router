import { AttemptBudget, type FailureEvidence } from "../src/budget.js";
import { buildCatalog, constructCandidates, type CandidateRules, type Capability, type Evidence,
  type ExecutionContract, type HostIdentity } from "../src/catalog.js";
import { digest } from "../src/canonical.js";
import type { RoutingProjection } from "../src/capsule.js";
import { QUESTION_TEMPLATE_DIGEST, descriptionsDigest, route, type AdapterContext } from "../src/jev-adapter.js";
import { MainTaskLifecycle } from "../src/lifecycle.js";
import { validate, type GuardContext } from "../src/policy-guard.js";
import { buildReceipt, type DecisionReceipt, type ReceiptOutcome } from "../src/receipt.js";
import { makePlan, type Annotations, type RoutePlan, type RouteRequest, type SelectionPolicy } from "../src/route-plan.js";
import { reviewRequired, type ReviewRisk } from "../src/review.js";
import { verifyCandidate, type VerifiedCandidate } from "../src/verification.js";
import { configErrors, priceWeightsDigest, type AblationId, type FrozenEconomics, type HarnessConfig } from "./config.js";

export interface ModelUsage {
  model: string;
  role: "root" | "worker" | "reviewer" | "jev";
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
}
export interface QualityRecord {
  completed: boolean;
  acceptance_met: boolean;
  critical_defects: number;
  human_interventions: number;
  restores: number;
  retries: number;
}
export interface BenchTask {
  task_id: string;
  stratum: string;
  root_intent_digest: string;
  delegate: boolean;
  delegate_fails_once: boolean;
  review_required: boolean;
  risk: ReviewRisk;
  baseline: Record<string, unknown>;
  current: Record<string, unknown>;
  owned_paths: string[];
  acceptance_ids: string[];
  command_id: string;
  arm_a_usage: ModelUsage[];
  arm_a_quality: QualityRecord;
  root_overhead_usage: ModelUsage[];
  worker_usage: ModelUsage[];
  reviewer_usage: ModelUsage[];
  jev_usage: ModelUsage[];
}
export interface Assignment {
  task_id: string;
  stratum: string;
  arm: "A" | "B" | "C";
  outcome: string;
  decision: "root" | "delegate" | "fallback" | "none";
  quality: QualityRecord;
  usage: ModelUsage[];
  weighted_cost: number;
  frontier_tokens: number;
  total_tokens: number;
}
export interface DryRunReport {
  harness_id: string;
  config_digest: string;
  corpus_digest: string;
  replay_digest: string;
  ablation: AblationId;
  arms: { A: { tasks: number }; B: { status: "unavailable" }; C: { tasks: number; receipts: number } };
  assignments: Assignment[];
}
export interface EndpointEvaluation {
  margin: number;
  mean_reduction: number;
  lower_bound: number;
  passed: boolean;
}
export interface Evaluation {
  quality_passed: boolean;
  economics_evaluated: boolean;
  endpoints: { weighted_cost: EndpointEvaluation; flagship_consumption: EndpointEvaluation };
  raw_total_tokens: { arm_a: number; arm_c: number };
  qualification_eligible: false;
  reasons: string[];
}

export class BenchError extends Error {
  constructor(message: string) {
    super(`BENCH_ERROR: ${message}`);
    this.name = "BenchError";
  }
}

const unknownQuality = (): QualityRecord => ({ completed: false, acceptance_met: false, critical_defects: 0,
  human_interventions: 0, restores: 0, retries: 0 });

export function weightedCost(usage: ModelUsage[], economics: FrozenEconomics): number {
  let total = 0;
  for (const item of usage) {
    const weight = economics.price_weights[item.model];
    if (!weight) throw new BenchError(`no frozen price weight for ${item.model}`);
    total += (item.input_tokens * weight.input_per_million + item.output_tokens * weight.output_per_million) / 1_000_000;
  }
  return total;
}
export function frontierTokens(usage: ModelUsage[], economics: FrozenEconomics): number {
  return usage.filter((item) => economics.flagship_models.includes(item.model))
    .reduce((sum, item) => sum + item.input_tokens + (item.reasoning_tokens ?? 0), 0);
}
export const totalTokens = (usage: ModelUsage[]): number =>
  usage.reduce((sum, item) => sum + item.input_tokens + item.output_tokens, 0);

function evidence(host: HostIdentity, id: string, now: number, level: Evidence["level"] = "REQUESTABLE"): Evidence {
  return { id, class: "OBSERVED", level, source: "trusted_host", host, observed_at: now - 10, valid_until: now + 1_000_000 };
}

function projectionFor(task: BenchTask, capsuleDigest: string, policyDigest: string): RoutingProjection {
  return {
    schema_revision: "bench-projection/1",
    projection_rule_digest: "bench-projection-rule",
    main_task_id: `main-${task.task_id}`,
    task_unit_id: "unit",
    capsule_revision: 1,
    capsule_digest: capsuleDigest,
    intent_digest: task.root_intent_digest,
    authorization_revision: "bench-authorization-1",
    objective_summary: `Deliver ${task.task_id} inside its authorized ownership.`,
    acceptance_summaries: task.acceptance_ids.map((id) => ({ id, summary: `Acceptance ${id} holds.` })),
    task_traits: {
      owned_file_count_bucket: "1", changed_language: ["typescript"], side_effect_class: "bounded_write",
      public_interface_touched: false, verification_count: 1, context_size_bucket: "1-4KiB",
      persistent_change: task.review_required, risk_flags: task.review_required ? ["security_path"] : []
    },
    interface_constraints: [],
    risk_flags: task.review_required ? ["security_path"] : [],
    side_effect_class: "bounded_write",
    relevant_context_summary: "Authorized fixture state for the benchmark dry-run.",
    context_complete: true,
    provenance: [{ kind: "trusted_host_policy_fact", ref: "bench-host", content_category: "task_summary", authority: "fact" }],
    egress_policy_digest: policyDigest
  };
}

function executionFor(task: BenchTask, host: HostIdentity): ExecutionContract {
  return {
    template_id: "bench-template", template_digest: "bench-template-digest", provider_id: "openai",
    model: "gpt-5.6-terra", reasoning_effort: "medium",
    agent: { kind: "builtin", id: "bench-worker", loaded_configuration_digest: "bench-profile" },
    skills: [], mcps: [], tools: [],
    filesystem: { read_roots: ["src"], write_paths: [...task.owned_paths], workspace_id: "bench-workspace", baseline_id: "bench-baseline" },
    network: { mode: "disabled", allowed_origins: [] },
    sandbox: { effective_policy_digest: "bench-sandbox", confinement_evidence_ref: "confinement" },
    approval_policy: "never", descendants_allowed: false, external_writes_allowed: false,
    context: { mode: "fresh", context_packet_digest: "bench-packet", fresh_context_evidence_ref: "confinement" },
    host_fingerprint: host.fingerprint, resolved_configuration_digest: "bench-configuration"
  };
}

function catalogFor(task: BenchTask, host: HostIdentity, now: number) {
  const entries: Capability[] = [
    { id: "openai/gpt-5.6-terra", kind: "model", content_digest: "terra", evidence: evidence(host, "model", now), effects: [] },
    { id: "bench-worker", kind: "agent", content_digest: "bench-profile", evidence: evidence(host, "agent", now), effects: [] },
    { id: "fresh", kind: "context", content_digest: "fresh", evidence: evidence(host, "context", now), effects: [] }
  ];
  return buildCatalog({ host, generation: 1,
    evidence: [evidence(host, "template", now), evidence(host, "confinement", now, "ENFORCEABLE")],
    entries,
    templates: [{ id: "bench-template", digest: "bench-template-digest", evidence_ref: "template",
      enforcement_refs: ["confinement"], configurations: [executionFor(task, host)] }] });
}

function rulesFor(task: BenchTask): CandidateRules {
  return { construction_rule_digest: "bench-construction", qualification_binding_ref: "bench-qualification",
    authorized_reads: ["src"], owned_writes: [...task.owned_paths], allowed_origins: [],
    authorized_skills: [], authorized_mcps: [], authorized_tools: [],
    qualify: () => true, describe: () => "Isolated delegated change under the frozen bench template.",
    continuation_proven: () => false };
}

function policyFor(): SelectionPolicy {
  return { id: "bench-policy", confidence_floor: 0.5, question_template_digest: QUESTION_TEMPLATE_DIGEST,
    binding_digest: digest("bench-qualification") };
}

function annotationsFor(task: BenchTask, reviewActive: boolean): Annotations {
  return { risk: { class: reviewActive ? "review_required" : "ordinary", source: "capsule_and_policy" },
    benefit_class: { value: "research_unqualified", evidence_ref: "bench-qualification" }, reason_codes: [] };
}

function guardContextFor(input: {
  task: BenchTask; request: RouteRequest; plan: RoutePlan; catalog: ReturnType<typeof catalogFor>; rules: CandidateRules;
  budget: AttemptBudget; host: HostIdentity; now: number; policy: SelectionPolicy; capsuleDigest: string;
  reviewActive: boolean;
}): GuardContext {
  const state = input.budget.snapshot();
  return {
    request: input.request, policy: input.policy, now: input.now, host: input.host,
    root: { model: "gpt-6-astra", effort: "high", evidence: evidence(input.host, "root", input.now, "ENFORCEABLE") },
    decision: { open: true, response_unused: true, request_digest: input.plan.selection.request_digest,
      question_digest: input.plan.selection.question_digest },
    catalog: input.catalog, rules: input.rules,
    capsule: { digest: input.capsuleDigest, revision: 1, acceptance_ids: [...input.task.acceptance_ids],
      original_acceptance_ids: [...input.task.acceptance_ids], owned_paths: [...input.task.owned_paths],
      validation_digest: "bench-validation", authorized_scope_digest: "bench-scope" },
    authorization: { scope_digest: "bench-scope", projection_digest: digest(input.request.routing_projection),
      egress_policy_digest: "bench-egress", expires_at: input.now + 1_000_000 },
    baseline: { id: "bench-baseline", workspace_id: "bench-workspace", owned_paths: [...input.task.owned_paths],
      recoverability_evidence: evidence(input.host, "recovery", input.now, "ENFORCEABLE"),
      integration_evidence: evidence(input.host, "integration", input.now, "ENFORCEABLE") },
    verification: [{ command_id: input.task.command_id, before_result_ref: "bench-pre-run", input_digest: "bench-input", observed_by: "root" }],
    qualification: { ok: true, mode: "research", profile_id: "bench", binding_digest: input.request.qualification_binding_ref,
      selection_policy: input.policy, max_worker_executions: 2, third_correction_failure_classes: [] },
    budget: { workers: state.worker_executions, unit_decisions: state.semantic_decisions.unit,
      current_http_attempts: state.http_attempts[input.request.decision_id] ?? 0, third_eligible: false,
      delegated_reviews: state.delegated_reviews, root_review_used: state.root_review_used },
    review: { required: input.reviewActive, model: "gpt-6-astra", effort: "medium", fresh: true,
      evidence: evidence(input.host, "review", input.now, "ENFORCEABLE") }
  };
}

function jevUsage(attempts: Array<{ input_tokens: number | "UNKNOWN"; output_tokens: number | "UNKNOWN" }>): ModelUsage[] {
  return attempts.map((attempt) => ({ model: "jev-1.13.0", role: "jev" as const,
    input_tokens: attempt.input_tokens === "UNKNOWN" ? 0 : attempt.input_tokens,
    output_tokens: attempt.output_tokens === "UNKNOWN" ? 0 : attempt.output_tokens }));
}

function assignmentFor(input: { task: BenchTask; arm: "A" | "C"; outcome: string; decision: Assignment["decision"];
  quality: QualityRecord; usage: ModelUsage[]; economics: FrozenEconomics }): Assignment {
  const usage = input.usage.map((item) => ({ ...item }));
  return { task_id: input.task.task_id, stratum: input.task.stratum, arm: input.arm, outcome: input.outcome,
    decision: input.decision, quality: { ...input.quality }, usage,
    weighted_cost: weightedCost(usage, input.economics), frontier_tokens: frontierTokens(usage, input.economics),
    total_tokens: totalTokens(usage) };
}

async function runPolicyArm(task: BenchTask, config: HarnessConfig, now: number, ablation: AblationId): Promise<{ assignment: Assignment; receipts: number }> {
  const host: HostIdentity = { session_id: "bench-session", fingerprint: "bench-host", configuration_digest: "bench-config" };
  const reviewActive = task.review_required && ablation !== "without_review";
  const mainTaskId = `main-${task.task_id}`;
  const budget = new AttemptBudget(mainTaskId, ["unit"]);
  const lifecycle = new MainTaskLifecycle({ main_task_id: mainTaskId, root_intent_digest: task.root_intent_digest, unit_ids: ["unit"], budget });
  const catalog = catalogFor(task, host, now);
  const rules = rulesFor(task);
  const policy = policyFor();
  const capsuleDigest = "bench-capsule";
  const snapshot = constructCandidates(catalog, rules, now);
  const usage: ModelUsage[] = task.root_overhead_usage.map((item) => ({ ...item }));
  const quality = unknownQuality();
  let outcome = "pending";
  let decision: Assignment["decision"] = "none";
  let receipts = 0;

  const base = {
    main_task_id: mainTaskId, task_unit_id: "unit", capsule_revision: 1,
    root_intent_digest: task.root_intent_digest, capsule_digest: capsuleDigest,
    counters_before: budget.snapshot(), counters_after: budget.snapshot()
  };
  const record = (receiptOutcome: ReceiptOutcome): DecisionReceipt => {
    receipts++;
    return buildReceipt({ ...base, counters_after: budget.snapshot(), outcome: receiptOutcome,
      violations: ["none"], usage_refs: [`usage-${task.task_id}`] });
  };

  for (let round = 0; round < 2; round += 1) {
    const decisionId = `d${round + 1}-${task.task_id}`;
    const operation = lifecycle.reserveDecision("unit", decisionId);
    const request: RouteRequest = {
      decision_id: decisionId, main_task_id: mainTaskId, task_unit_id: "unit", capsule_revision: 1,
      routing_projection: projectionFor(task, capsuleDigest, "bench-egress") as unknown as Record<string, unknown>,
      candidate_snapshot: snapshot, attempt_snapshot: { decision_count: round + 1, worker_execution_count: budget.snapshot().worker_executions },
      frozen_selection_policy_ref: policy.id, qualification_binding_ref: "bench-qualification", evidence_mode: "simulation"
    };
    const choice = task.delegate && ablation !== "without_worker" ? snapshot.candidates[1].candidate_id : "root";
    const probabilities = Object.fromEntries(snapshot.candidates.map((candidate) =>
      [candidate.candidate_id, candidate.candidate_id === choice ? 0.9 : 0.1 / (snapshot.candidates.length - 1)]));
    const jev = task.jev_usage[0];
    const adapter: AdapterContext = {
      api_key: "dry-run",
      egress: { origin: "https://api.typesafe.ai", policy_digest: "bench-egress", projection_digest: digest(request.routing_projection),
        candidate_descriptions_digest: descriptionsDigest(request), expires_at: Date.now() + 60_000 },
      sizing: { provider_model: "jev-1.13.0", evidence_digest: config.sizing_evidence_digest, count: () => 1_000 },
      approved_sizing_digests: [config.sizing_evidence_digest],
      annotations: annotationsFor(task, reviewActive),
      decision_open: () => true,
      reserve_http_attempt: (id) => { try { budget.reserveHttp(id); return true; } catch { return false; } },
      fetch: async () => new Response(JSON.stringify({ model: "jev-1.13.0",
        answers: { route: { choice, confidence: 0.9, probabilities } },
        usage: { input_tokens: jev.input_tokens, output_tokens: jev.output_tokens } }),
        { status: 200, headers: { "content-type": "application/json" } })
    };
    const routing = await route(request, policy, new AbortController().signal, adapter);
    if (!routing.ok) {
      usage.push(...jevUsage(routing.failure.provider_attempts));
      lifecycle.decisionFailed("unit", operation, operation.revision, "provider_failure");
      record({ kind: "adapter_failed", routing_failure: routing.failure });
      outcome = "root_fallback";
      decision = "fallback";
      break;
    }
    usage.push(...jevUsage(routing.provider_attempts));
    const plan = routing.plan;
    const verdict = validate(plan, guardContextFor({ task, request, plan, catalog, rules, budget, host, now, policy,
      capsuleDigest, reviewActive }));
    if (verdict.verdict === "DENY") {
      lifecycle.guardDenied("unit", verdict.reason, operation, operation.revision);
      record({ kind: "guard_denied", reason: verdict.reason });
      outcome = "guard_denied";
      decision = "fallback";
      break;
    }
    if (plan.decision === "root") {
      lifecycle.planRoot("unit", operation, operation.revision);
      record({ kind: "root_selected", plan });
      outcome = "root_selected";
      decision = "root";
      quality.completed = true;
      quality.acceptance_met = true;
      break;
    }
    const executionId = `e${round + 1}-${task.task_id}`;
    lifecycle.planDelegate("unit", operation, operation.revision, { execution_id: executionId, continuation: { mode: "fresh", proven: true } });
    usage.push(...task.worker_usage);
    lifecycle.executionCompleted("unit", executionId);
    const fails = task.delegate_fails_once && round === 0;
    const verification = await verifyCandidate({
      baseline: { entries: task.baseline, digest: digest(task.baseline) },
      snapshot: async () => ({ entries: task.current, digest: digest(task.current) }),
      dependency_digest: async () => "bench-dependencies",
      owned_paths: task.owned_paths, acceptance_ids: task.acceptance_ids,
      commands: [{ id: task.command_id, argv: ["node", "bench-command.js"], cwd: ".", expected_exit: 0,
        dependency_paths: [], dependency_coverage: "complete" }],
      previous_results: [], read_complete_diff: async () => {},
      run: async () => ({ exit_code: fails ? 1 : 0, output_digest: fails ? "failed-output" : "bench-output" }),
      assess_acceptance: async () => task.acceptance_ids
    });
    if (!verification.ok) {
      quality.restores++;
      const failure: FailureEvidence = { execution_id: executionId, task_unit_id: "unit", class: "verification",
        fault_id: task.command_id, restoration_result: "restored", acceptance_digest: "bench-acceptance",
        original_acceptance_digest: "bench-acceptance", correction_scope_unchanged: true };
      const failureOutcome = lifecycle.verificationFailed("unit", failure);
      record({ kind: "candidate_rejected", execution_id: executionId, verification: { reason: verification.reason, commands: verification.commands }, recovery: "restored" });
      if (ablation === "without_correction" || !failureOutcome.actions.includes("fresh_decision_required")) {
        outcome = "root_fallback";
        decision = "fallback";
        break;
      }
      quality.retries++;
      continue;
    }
    const required = reviewActive && reviewRequired(task.risk);
    lifecycle.verificationPassed("unit", required);
    if (required) {
      budget.reserveReview(verification.candidate.candidate_digest, "worker");
      usage.push(...task.reviewer_usage);
      lifecycle.reviewOutcome("unit", "ACCEPT");
    }
    lifecycle.beginIntegration("unit");
    lifecycle.integrationOutcome("unit", "integrated");
    record({ kind: "candidate_adopted", execution_id: executionId, disposition: "accepted",
      verification: verification.candidate, integration: "bench-integrated" } as ReceiptOutcome);
    outcome = "accepted";
    decision = "delegate";
    quality.completed = true;
    quality.acceptance_met = true;
    break;
  }

  return { assignment: assignmentFor({ task, arm: "C", outcome, decision, quality, usage, economics: config.economics }), receipts };
}

export async function runDryRun(config: HarnessConfig, corpus: BenchTask[], ablation: AblationId = "full_policy"): Promise<DryRunReport> {
  const errors = configErrors(config);
  if (errors.length > 0) throw new BenchError(`invalid harness config: ${errors.join(", ")}`);
  if (!config.ablations.includes(ablation)) throw new BenchError(`ablation is not frozen in the harness config: ${ablation}`);
  if (corpus.length === 0) throw new BenchError("empty corpus");
  if (new Set(corpus.map((task) => task.task_id)).size !== corpus.length) throw new BenchError("duplicate task IDs");
  const unknownStrata = [...new Set(corpus.map((task) => task.stratum))].filter((stratum) => !config.strata.includes(stratum));
  if (unknownStrata.length > 0) throw new BenchError(`undeclared strata: ${unknownStrata.join(", ")}`);

  const assignments: Assignment[] = [];
  let receipts = 0;
  for (const task of corpus) {
    assignments.push(assignmentFor({ task, arm: "A", outcome: "root_direct", decision: "root",
      quality: { ...task.arm_a_quality }, usage: task.arm_a_usage, economics: config.economics }));
  }
  for (const task of corpus) {
    const result = await runPolicyArm(task, config, config.frozen_at, ablation);
    assignments.push(result.assignment);
    receipts += result.receipts;
  }
  const replayDigest = digest({ ablation, assignments: assignments.map((assignment) => ({ ...assignment, usage: assignment.usage })) });
  return {
    harness_id: config.harness_id,
    config_digest: digest({ ...config, price_weights_digest: priceWeightsDigest(config.economics.price_weights) }),
    corpus_digest: digest(corpus.map((task) => task.task_id)),
    replay_digest: replayDigest,
    ablation,
    arms: { A: { tasks: corpus.length }, B: { status: "unavailable" }, C: { tasks: corpus.length, receipts } },
    assignments
  };
}

function lowerBound(values: number[], z: number): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length < 2) return mean;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return mean - z * Math.sqrt(variance / values.length);
}

export function evaluate(report: DryRunReport, config: HarnessConfig): Evaluation {
  const reasons: string[] = [];
  const assignmentsA = new Map(report.assignments.filter((a) => a.arm === "A").map((a) => [a.task_id, a]));
  const assignmentsC = new Map(report.assignments.filter((a) => a.arm === "C").map((a) => [a.task_id, a]));
  for (const task of [...assignmentsA.keys(), ...assignmentsC.keys()]) {
    if (!assignmentsA.has(task) || !assignmentsC.has(task)) reasons.push(`ITT assignment missing for ${task}`);
  }
  const cAssignments = [...assignmentsC.values()];
  const completed = cAssignments.filter((assignment) => assignment.quality.completed && assignment.quality.acceptance_met).length;
  const completion = cAssignments.length === 0 ? 0 : completed / cAssignments.length;
  const defects = cAssignments.reduce((sum, assignment) => sum + assignment.quality.critical_defects, 0);
  const qualityPassed = reasons.length === 0 && defects <= config.quality_margins.critical_defects &&
    completion >= config.quality_margins.min_completion;
  const costReductions: number[] = [];
  const frontierReductions: number[] = [];
  for (const [taskId, armA] of assignmentsA) {
    const armC = assignmentsC.get(taskId);
    if (!armC) continue;
    costReductions.push(armA.weighted_cost === 0 ? 0 : (armA.weighted_cost - armC.weighted_cost) / armA.weighted_cost);
    frontierReductions.push(armA.frontier_tokens === 0 ? 0 : (armA.frontier_tokens - armC.frontier_tokens) / armA.frontier_tokens);
  }
  const endpoint = (values: number[], margin: number): EndpointEvaluation => {
    const mean = values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
    const bound = qualityPassed ? lowerBound(values, config.economics.z) : 0;
    return { margin, mean_reduction: mean, lower_bound: bound, passed: qualityPassed && bound > margin };
  };
  if (!qualityPassed) reasons.push("QUALITY_GATE_FAILED");
  if (report.ablation !== "full_policy") reasons.push("ABLATION_NOT_QUALIFIABLE");
  return {
    quality_passed: qualityPassed,
    economics_evaluated: qualityPassed,
    endpoints: {
      weighted_cost: endpoint(costReductions, config.economics.margins.weighted_cost),
      flagship_consumption: endpoint(frontierReductions, config.economics.margins.flagship_consumption)
    },
    raw_total_tokens: {
      arm_a: [...assignmentsA.values()].reduce((sum, assignment) => sum + assignment.total_tokens, 0),
      arm_c: [...assignmentsC.values()].reduce((sum, assignment) => sum + assignment.total_tokens, 0)
    },
    qualification_eligible: false,
    reasons: [...reasons, "DRY_RUN_ONLY"]
  };
}

export { configErrors, priceWeightsDigest };
