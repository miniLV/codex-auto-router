import { digest } from "./canonical.js";
import type { SelectionPolicy } from "./route-plan.js";

export type FailureClass = "verification" | "semantic_revision" | "tool_execution";
export type Traits = Record<string, string | number | boolean>;
export interface ContractBindings {
  contract_revision: string;
  projection_rule_digest: string;
  question_digest: string;
  candidate_construction_digest: string;
  provider_model: "jev-1.13.0";
  sizing_method_digest: string;
  host_contract_id: string;
  execution_template_digests: string[];
  review_template_digest: string;
  verification_regime_digest: string;
  transport_policy_digest: string;
  language_regime: string;
  attempt_regime_digest: string;
}
export interface QualificationProfile {
  profile_id: string;
  observable_predicate: Record<string, Array<string | number | boolean>>;
  supported_candidate_families: string[];
  confidence_floor_by_review_class: { ordinary: number; review_required: number };
  quality_result: {
    endpoints: Array<{ id: string; margin: number; lower_bound: number }>;
    critical_regressions: number; sufficient_power: boolean; complete_outcomes: boolean; passed: boolean;
  };
  economic_result: {
    weighted_cost_margin: number; flagship_consumption_margin: number;
    lower_bounds: { weighted_cost: number; flagship_consumption: number };
    coverage: number; missingness_bounded: boolean; passed: boolean;
  };
  automatic_routing_allowed: boolean;
  max_worker_executions: 2 | 3;
  third_correction: { allowed: boolean; failure_classes: FailureClass[]; evidence_report_ref: string };
}
export interface QualificationArtifact {
  schema_revision: 1; artifact_id: string; evidence_report_digest: string; issued_at: number;
  experiment_id: string; holdout_fixture_digest: string; statistical_plan_digest: string;
  bindings: ContractBindings; profiles: QualificationProfile[];
}
export interface ExperimentManifest {
  experiment_id: string; authorization_ref: string; mode: "research";
  fixture_set_digest: string; bindings: ContractBindings;
  profiles: Array<Pick<QualificationProfile, "profile_id" | "observable_predicate" | "supported_candidate_families" | "confidence_floor_by_review_class">>;
  worker_cap: 2 | 3; third_correction_failure_classes: FailureClass[];
  frozen_at: number; expires_at: number; statistical_plan_digest: string; retention_policy_digest: string;
}
export type QualificationResult = { ok: false; reason: string } | {
  ok: true; mode: "production" | "research"; profile_id: string; binding_digest: string;
  selection_policy: SelectionPolicy; max_worker_executions: 2 | 3; third_correction_failure_classes: FailureClass[];
};

const finite = (n: number) => Number.isFinite(n);
const floorValid = (n: number) => finite(n) && n >= 0 && n <= 1;
const matches = (predicate: QualificationProfile["observable_predicate"], traits: Traits) =>
  Object.entries(predicate).every(([key, values]) => values.includes(traits[key]));
export function profilesDisjoint(profiles: Array<Pick<QualificationProfile, "profile_id" | "observable_predicate">>): boolean {
  if (new Set(profiles.map(p => p.profile_id)).size !== profiles.length) return false;
  for (const p of profiles) if (!p.profile_id || Object.keys(p.observable_predicate).length === 0 ||
    Object.values(p.observable_predicate).some(v => v.length === 0 || v.some(x => typeof x === "number" && !finite(x)))) return false;
  for (let i = 0; i < profiles.length; i++) for (let j = i + 1; j < profiles.length; j++) {
    const a = profiles[i].observable_predicate, b = profiles[j].observable_predicate;
    if (!Object.keys(a).some(key => key in b && !a[key].some(v => b[key].includes(v)))) return false;
  }
  return true;
}

export function profilePasses(p: QualificationProfile): boolean {
  const q = p.quality_result, e = p.economic_result;
  // Economic inference is deliberately below every quality gate.
  if (!q.passed || !q.sufficient_power || !q.complete_outcomes || q.critical_regressions !== 0 ||
      q.endpoints.length === 0 || !q.endpoints.every(x => finite(x.margin) && x.margin >= 0 &&
        finite(x.lower_bound) && x.lower_bound >= -x.margin)) return false;
  return e.passed && e.missingness_bounded && e.coverage > 0 && e.coverage <= 1 &&
    [e.weighted_cost_margin, e.flagship_consumption_margin].every(x => finite(x) && x >= 0) &&
    Object.values(e.lower_bounds).every(finite) &&
    (e.lower_bounds.weighted_cost > e.weighted_cost_margin || e.lower_bounds.flagship_consumption > e.flagship_consumption_margin);
}

export function qualify(input: {
  artifact?: QualificationArtifact; research?: ExperimentManifest;
  // Populated by a trusted installation / host policy, not data from the candidate or Jev.
  trusted_artifact_digests: string[]; authorized_research_digests: string[];
  bindings: ContractBindings; traits: Traits; candidate_families: string[];
  review_class: "ordinary" | "review_required"; now: number;
}): QualificationResult {
  const deny = (reason: string): QualificationResult => ({ ok: false, reason });
  try {
    if (Boolean(input.artifact) === Boolean(input.research)) return deny("QUALIFICATION_MISSING_OR_AMBIGUOUS");
    const source = input.artifact ?? input.research!;
    const isResearch = Boolean(input.research);
    if (!(isResearch ? input.authorized_research_digests : input.trusted_artifact_digests).includes(digest(source))) return deny("EVIDENCE_UNTRUSTED");
    if (digest(source.bindings) !== digest(input.bindings)) return deny("BINDING_CHANGED");
    if (input.research && (input.research.mode !== "research" || !input.research.authorization_ref ||
      input.research.frozen_at > input.now || input.now >= input.research.expires_at)) return deny("RESEARCH_UNAUTHORIZED");
    if (input.artifact && (input.artifact.schema_revision !== 1 || input.artifact.issued_at > input.now ||
      !input.artifact.evidence_report_digest || !input.artifact.statistical_plan_digest)) return deny("EVIDENCE_INVALID");
    if (!profilesDisjoint(source.profiles)) return deny("PROFILES_OVERLAP_OR_INVALID");
    const profiles = source.profiles.filter(p => matches(p.observable_predicate, input.traits));
    if (profiles.length !== 1) return deny("PROFILE_UNQUALIFIED");
    const p = profiles[0];
    if (input.candidate_families.length === 0 ||
      !input.candidate_families.every(f => p.supported_candidate_families.includes(f))) return deny("FAMILY_UNQUALIFIED");
    if (!Object.values(p.confidence_floor_by_review_class).every(floorValid)) return deny("MISSING_SELECTION_POLICY");
    const production = input.artifact?.profiles.find(x => x.profile_id === p.profile_id);
    if (production && (!production.automatic_routing_allowed || !profilePasses(production))) return deny("PROFILE_UNQUALIFIED");
    const max = production?.max_worker_executions ?? input.research!.worker_cap;
    if (max !== 2 && max !== 3) return deny("INVALID_ATTEMPT_REGIME");
    const third = production ? (production.third_correction.allowed && production.third_correction.evidence_report_ref ?
      production.third_correction.failure_classes : []) : input.research!.third_correction_failure_classes;
    if (third.some(c => !["verification", "semantic_revision", "tool_execution"].includes(c)) || (max === 2 && third.length)) return deny("INVALID_ATTEMPT_REGIME");
    return { ok: true, mode: isResearch ? "research" : "production", profile_id: p.profile_id,
      binding_digest: digest(source), max_worker_executions: max, third_correction_failure_classes: third,
      selection_policy: { id: digest({ source: digest(source), profile: p.profile_id, risk: input.review_class }),
        confidence_floor: p.confidence_floor_by_review_class[input.review_class],
        question_template_digest: source.bindings.question_digest, binding_digest: digest(source.bindings) } };
  } catch { return deny("EVIDENCE_INVALID"); }
}
