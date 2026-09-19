import { digest } from "./canonical.js";
import type { CandidateSnapshot, ExecutionContract, Candidate } from "./catalog.js";

export interface SelectionPolicy {
  id: string;
  confidence_floor: number;
  question_template_digest: string;
  binding_digest: string;
}
export interface RouteRequest {
  decision_id: string;
  main_task_id: string;
  task_unit_id: string;
  capsule_revision: number;
  routing_projection: Record<string, unknown>;
  candidate_snapshot: CandidateSnapshot;
  attempt_snapshot: { decision_count: number; worker_execution_count: number };
  frozen_selection_policy_ref: string;
  qualification_binding_ref: string;
  evidence_mode: "production" | "simulation";
}
export interface SelectionEvidence {
  decision_id: string;
  candidate_snapshot_digest: string;
  provider_model: string;
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  request_digest: string;
  question_digest: string;
  question_template_digest: string;
}
export interface Annotations {
  risk: { class: "ordinary" | "review_required"; source: "capsule_and_policy" };
  benefit_class: { value: "qualified_delivery_economics" | "research_unqualified" | "root_baseline"; evidence_ref: string };
  reason_codes: string[];
}
export type RoutePlan =
  { decision: "root"; candidate_id: "root"; selection: SelectionEvidence; annotations: Annotations } |
  { decision: "delegate"; candidate_id: string; execution: ExecutionContract; selection: SelectionEvidence; annotations: Annotations };
export interface ProviderAttempt {
  decision_id: string; attempt_index: number; started_at: number; finished_at: number;
  status: string; request_digest: string;
  input_tokens: number | "UNKNOWN"; output_tokens: number | "UNKNOWN";
  retry_after?: string;
}
export interface RoutingFailure {
  kind: "UNAVAILABLE" | "MALFORMED" | "LOW_CONFIDENCE" | "UNSAFE_PROJECTION" | "INPUT_UNSUPPORTED" | "CANCELLED";
  reason_code: string;
  decision_id: string;
  selection_evidence?: SelectionEvidence;
  provider_attempts: ProviderAttempt[];
}
export type RoutingResult = { ok: true; plan: RoutePlan; provider_attempts: ProviderAttempt[] } | { ok: false; failure: RoutingFailure };

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
export const textValue = (v: unknown): v is string => typeof v === "string" && v.length > 0;
export const stringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(textValue) && new Set(v).size === v.length;
export const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fraction = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function validExecution(v: unknown): v is ExecutionContract {
  if (!isRecord(v) || !exactKeys(v, ["template_id", "template_digest", "provider_id", "model", "reasoning_effort",
    "agent", "skills", "mcps", "tools", "filesystem", "network", "sandbox", "approval_policy",
    "descendants_allowed", "external_writes_allowed", "context", "host_fingerprint", "resolved_configuration_digest"])) return false;
  if (![v.template_id, v.template_digest, v.provider_id, v.model, v.reasoning_effort, v.approval_policy,
    v.host_fingerprint, v.resolved_configuration_digest].every(textValue) ||
    ![v.skills, v.mcps, v.tools].every(stringList) || v.descendants_allowed !== false || v.external_writes_allowed !== false) return false;
  const { agent: a, filesystem: f, network: n, sandbox: s, context: c } = v;
  if (!isRecord(a) || !exactKeys(a, ["kind", "id", "loaded_configuration_digest"]) ||
      !["builtin", "custom"].includes(String(a.kind)) || !textValue(a.id) || !textValue(a.loaded_configuration_digest)) return false;
  if (!isRecord(f) || !exactKeys(f, ["read_roots", "write_paths", "workspace_id", "baseline_id"]) ||
      !stringList(f.read_roots) || !stringList(f.write_paths) || !textValue(f.workspace_id) || !textValue(f.baseline_id)) return false;
  if (!isRecord(n) || !exactKeys(n, ["mode", "allowed_origins"]) || !stringList(n.allowed_origins) ||
      !["disabled", "read_only_allowlist"].includes(String(n.mode)) || (n.mode === "disabled" && n.allowed_origins.length > 0)) return false;
  if (!isRecord(s) || !exactKeys(s, ["effective_policy_digest", "confinement_evidence_ref"]) || !Object.values(s).every(textValue)) return false;
  if (!isRecord(c) || !Object.values(c).every(textValue)) return false;
  return c.mode === "fresh" ? exactKeys(c, ["mode", "context_packet_digest", "fresh_context_evidence_ref"]) :
    c.mode === "continuation" && exactKeys(c, ["mode", "context_packet_digest", "worker_id", "handle_ref",
      "previous_execution_id", "ownership_digest", "revalidation_evidence_ref"]);
}

export function validSnapshot(snapshot: CandidateSnapshot): boolean {
  try {
    const { digest: expected, ...body } = snapshot;
    if (expected !== digest(body) || !textValue(snapshot.construction_rule_digest) ||
      !Array.isArray(snapshot.candidates) || snapshot.candidates.length < 1 ||
      new Set(snapshot.candidates.map(c => c.candidate_id)).size !== snapshot.candidates.length) return false;
    let roots = 0;
    for (const value of snapshot.candidates) {
      const c: unknown = value;
      if (!isRecord(c)) return false;
      if (c.decision === "root") {
        if (!exactKeys(c, ["candidate_id", "decision"]) || c.candidate_id !== "root") return false;
        roots++;
      } else if (c.decision !== "delegate" || !exactKeys(c, ["candidate_id", "decision", "execution", "capability_evidence_refs",
        "qualification_binding_ref", "safe_description"]) || !validExecution(c.execution) ||
        c.candidate_id !== `c_${digest(c.execution)}` || !stringList(c.capability_evidence_refs) ||
        !textValue(c.qualification_binding_ref) || !textValue(c.safe_description)) return false;
    }
    return roots === 1;
  } catch { return false; }
}

export function validSelection(s: SelectionEvidence, request: RouteRequest, policy: SelectionPolicy): boolean {
  if (!isRecord(s) || !exactKeys(s, ["decision_id", "candidate_snapshot_digest", "provider_model", "choice", "confidence",
    "probabilities", "request_digest", "question_digest", "question_template_digest"]) || s.decision_id !== request.decision_id ||
    s.candidate_snapshot_digest !== request.candidate_snapshot.digest || s.provider_model !== "jev-1.13.0" ||
    s.question_template_digest !== policy.question_template_digest || !textValue(s.question_digest) || !textValue(s.request_digest) || !fraction(s.confidence) ||
    !isRecord(s.probabilities)) return false;
  const options = request.candidate_snapshot.candidates.map(c => c.candidate_id);
  const values = Object.values(s.probabilities);
  return exactKeys(s.probabilities, options) && options.includes(s.choice) && values.every(fraction) &&
    Math.abs(values.reduce((a, b) => a + b, 0) - 1) <= 0.000001 &&
    s.probabilities[s.choice] + 0.000001 >= Math.max(...values);
}

export function makePlan(candidate: Candidate, selection: SelectionEvidence, annotations: Annotations): RoutePlan {
  const facts = structuredClone(annotations);
  if (candidate.decision === "root") {
    facts.benefit_class.value = "root_baseline";
    facts.reason_codes = ["JEV_ROOT"];
    return { decision: "root", candidate_id: "root", selection, annotations: facts };
  }
  facts.reason_codes = ["JEV_DELEGATE", candidate.execution.context.mode === "fresh" ? "FRESH_CONTEXT" : "PROVEN_CONTINUATION",
    facts.benefit_class.value === "qualified_delivery_economics" ? "QUALIFIED_DELIVERY_ECONOMICS" : "RESEARCH_UNQUALIFIED"];
  return { decision: "delegate", candidate_id: candidate.candidate_id, execution: structuredClone(candidate.execution), selection, annotations: facts };
}

export function validPlan(plan: RoutePlan, request: RouteRequest, policy: SelectionPolicy): boolean {
  try {
    if (!isRecord(plan) || !validSnapshot(request.candidate_snapshot) || !validSelection(plan.selection, request, policy)) return false;
    const candidate = request.candidate_snapshot.candidates.find(c => c.candidate_id === plan.candidate_id);
    if (!candidate || plan.selection.choice !== plan.candidate_id || candidate.decision !== plan.decision) return false;
    if (!exactKeys(plan, plan.decision === "root" ? ["decision", "candidate_id", "selection", "annotations"] :
      ["decision", "candidate_id", "execution", "selection", "annotations"])) return false;
    const a = plan.annotations;
    if (!isRecord(a) || !exactKeys(a, ["risk", "benefit_class", "reason_codes"]) || !isRecord(a.risk) ||
      !exactKeys(a.risk, ["class", "source"]) || !["ordinary", "review_required"].includes(String(a.risk.class)) ||
      a.risk.source !== "capsule_and_policy" || !isRecord(a.benefit_class) ||
      !exactKeys(a.benefit_class, ["value", "evidence_ref"]) || !textValue(a.benefit_class.evidence_ref) ||
      !["qualified_delivery_economics", "research_unqualified", "root_baseline"].includes(String(a.benefit_class.value)) ||
      !stringList(a.reason_codes) || !a.reason_codes.every(r => ["JEV_ROOT", "JEV_DELEGATE", "FRESH_CONTEXT",
        "PROVEN_CONTINUATION", "QUALIFIED_DELIVERY_ECONOMICS", "RESEARCH_UNQUALIFIED"].includes(r))) return false;
    return plan.decision === "root" || (candidate.decision === "delegate" && validExecution(plan.execution) &&
      digest(plan.execution) === digest(candidate.execution));
  } catch { return false; }
}
