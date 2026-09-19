import { digest } from "./canonical.js";

export type EvidenceLevel = "DISCOVERED" | "REQUESTABLE" | "ENFORCEABLE" | "APPLIED";
export interface HostIdentity { session_id: string; fingerprint: string; configuration_digest: string }
export interface Evidence {
  id: string;
  class: "OBSERVED" | "UNKNOWN";
  level: EvidenceLevel;
  source: "trusted_host" | "file" | "tool_listing" | "worker";
  host: HostIdentity;
  observed_at: number;
  valid_until: number;
  execution_id?: string;
}
export interface Capability {
  id: string;
  kind: "model" | "agent" | "skill" | "mcp" | "tool" | "context" | "template";
  content_digest: string;
  evidence: Evidence;
  effects: Array<"read" | "isolated_write" | "external_write" | "spawn">;
}
export interface ExecutionContract {
  template_id: string;
  template_digest: string;
  provider_id: string;
  model: string;
  reasoning_effort: string;
  agent: { kind: "builtin" | "custom"; id: string; loaded_configuration_digest: string };
  skills: string[];
  mcps: string[];
  tools: string[];
  filesystem: { read_roots: string[]; write_paths: string[]; workspace_id: string; baseline_id: string };
  network: { mode: "disabled" | "read_only_allowlist"; allowed_origins: string[] };
  sandbox: { effective_policy_digest: string; confinement_evidence_ref: string };
  approval_policy: string;
  descendants_allowed: false;
  external_writes_allowed: false;
  context: { mode: "fresh"; context_packet_digest: string; fresh_context_evidence_ref: string } |
    { mode: "continuation"; context_packet_digest: string; worker_id: string; handle_ref: string;
      previous_execution_id: string; ownership_digest: string; revalidation_evidence_ref: string };
  host_fingerprint: string;
  resolved_configuration_digest: string;
}
export interface ExecutionTemplate {
  id: string;
  digest: string;
  evidence_ref: string;
  enforcement_refs: string[];
  // These are complete host-resolved recipes, not independently combined grants.
  configurations: ExecutionContract[];
}
export interface CapabilityCatalog {
  host: HostIdentity;
  generation: number;
  entries: Capability[];
  evidence: Evidence[];
  templates: ExecutionTemplate[];
  digest: string;
}
export type RootCandidate = { candidate_id: "root"; decision: "root" };
export interface DelegateCandidate {
  candidate_id: string;
  decision: "delegate";
  execution: ExecutionContract;
  capability_evidence_refs: string[];
  qualification_binding_ref: string;
  safe_description: string;
}
export type Candidate = RootCandidate | DelegateCandidate;
export interface CandidateSnapshot {
  candidates: Candidate[];
  construction_rule_digest: string;
  exclusion_records: Array<{ contract_digest: string; reason: string }>;
  digest: string;
}

export function evidenceValid(e: Evidence, host: HostIdentity, now: number, enforcement = false): boolean {
  return e.class === "OBSERVED" && e.source === "trusted_host" &&
    (enforcement ? e.level === "ENFORCEABLE" : ["REQUESTABLE", "ENFORCEABLE"].includes(e.level)) &&
    digest(e.host) === digest(host) && Number.isFinite(now) &&
    Number.isFinite(e.observed_at) && Number.isFinite(e.valid_until) &&
    e.observed_at <= now && now < e.valid_until && !e.execution_id;
}

export function buildCatalog(input: Omit<CapabilityCatalog, "digest">): CapabilityCatalog {
  if (!Number.isSafeInteger(input.generation) || input.generation < 0) throw new Error("INVALID_GENERATION");
  for (const records of [input.entries, input.evidence, input.templates]) {
    if (new Set(records.map(e => e.id)).size !== records.length) throw new Error("DUPLICATE_CATALOG_ID");
  }
  const body = structuredClone({ host: input.host, generation: input.generation,
    entries: [...input.entries].sort((a, b) => a.id.localeCompare(b.id)),
    evidence: [...input.evidence].sort((a, b) => a.id.localeCompare(b.id)),
    templates: [...input.templates].sort((a, b) => a.id.localeCompare(b.id)) });
  return { ...body, digest: digest(body) };
}

export function catalogFresh(catalog: CapabilityCatalog, host: HostIdentity, now: number): boolean {
  const { digest: expected, ...body } = catalog;
  return expected === digest(body) && digest(host) === digest(catalog.host) &&
    catalog.evidence.every(e => e.class === "UNKNOWN" || e.level === "DISCOVERED" ||
      (e.level === "APPLIED" ? false : evidenceValid(e, host, now)));
}

export interface CandidateRules {
  construction_rule_digest: string;
  qualification_binding_ref: string;
  authorized_reads: string[];
  owned_writes: string[];
  allowed_origins: string[];
  // Required effective grant sets: empty means none, missing is invalid.
  authorized_skills: string[];
  authorized_mcps: string[];
  authorized_tools: string[];
  // Frozen family eligibility, never a ranking or a top-K filter.
  qualify: (contract: ExecutionContract) => boolean;
  describe: (contract: ExecutionContract) => string;
  continuation_proven: (contract: ExecutionContract) => boolean;
}

export function configurationReason(c: ExecutionContract, catalog: CapabilityCatalog,
  rules: CandidateRules, now: number): string | undefined {
  if (!catalogFresh(catalog, catalog.host, now)) return "CATALOG_CHANGED";
  const template = catalog.templates.find(t => t.id === c.template_id && t.digest === c.template_digest);
  if (!template || !template.configurations.some(x => digest(x) === digest(c))) return "INCOMPATIBLE_CONFIGURATION";
  const evidence = (id: string, enforcement = false) => {
    const e = catalog.evidence.find(x => x.id === id);
    return e !== undefined && evidenceValid(e, catalog.host, now, enforcement);
  };
  if (!evidence(template.evidence_ref) || template.enforcement_refs.length === 0 ||
      !template.enforcement_refs.every(id => evidence(id, true)) ||
      !evidence(c.sandbox.confinement_evidence_ref, true)) return "PERMISSION_UNPROVEN";
  if (c.host_fingerprint !== catalog.host.fingerprint || c.descendants_allowed !== false ||
      c.external_writes_allowed !== false) return "FORBIDDEN_EFFECT";
  const subset = (a: string[], b: string[]) => a.every(x => b.includes(x));
  if (!subset(c.filesystem.read_roots, rules.authorized_reads) ||
      !subset(c.filesystem.write_paths, rules.owned_writes) ||
      !subset(c.network.allowed_origins, rules.allowed_origins) ||
      !subset(c.skills, rules.authorized_skills) ||
      !subset(c.mcps, rules.authorized_mcps) ||
      !subset(c.tools, rules.authorized_tools) ||
      (c.network.mode === "disabled" && c.network.allowed_origins.length !== 0)) return "EXCESS_GRANT";
  if (!c.filesystem.workspace_id || !c.filesystem.baseline_id) return "BASELINE_UNSAFE";
  const requests: Array<[Capability["kind"], string]> = [
    ["model", `${c.provider_id}/${c.model}`], ["agent", c.agent.id], ["context", c.context.mode],
    ...c.skills.map(x => ["skill", x] as ["skill", string]),
    ...c.mcps.map(x => ["mcp", x] as ["mcp", string]),
    ...c.tools.map(x => ["tool", x] as ["tool", string])
  ];
  for (const [kind, id] of requests) {
    const entry = catalog.entries.find(x => x.id === id && x.kind === kind);
    if (!entry || !evidenceValid(entry.evidence, catalog.host, now)) return "CAPABILITY_UNKNOWN";
    if (entry.effects.some(e => e === "external_write" || e === "spawn")) return "FORBIDDEN_EFFECT";
  }
  if (c.context.mode === "fresh" && !evidence(c.context.fresh_context_evidence_ref, true)) return "CONTEXT_UNPROVEN";
  if (c.context.mode === "continuation" && (!evidence(c.context.revalidation_evidence_ref) ||
      !rules.continuation_proven(c))) return "CONTINUATION_UNPROVEN";
  if (!rules.qualify(c)) return "PROFILE_UNQUALIFIED";
  return undefined;
}

export function constructCandidates(catalog: CapabilityCatalog, rules: CandidateRules, now: number): CandidateSnapshot {
  const candidates = new Map<string, DelegateCandidate>();
  const exclusion_records: CandidateSnapshot["exclusion_records"] = [];
  for (const template of catalog.templates) for (const contract of template.configurations) {
    const contract_digest = digest(contract);
    const reason = configurationReason(contract, catalog, rules, now);
    if (reason) { exclusion_records.push({ contract_digest, reason }); continue; }
    const execution = structuredClone(contract);
    const candidate_id = `c_${contract_digest}`;
    candidates.set(candidate_id, { candidate_id, decision: "delegate", execution,
      capability_evidence_refs: [template.evidence_ref, ...template.enforcement_refs],
      qualification_binding_ref: rules.qualification_binding_ref, safe_description: rules.describe(execution) });
  }
  const body: Omit<CandidateSnapshot, "digest"> = {
    candidates: [{ candidate_id: "root", decision: "root" }, ...[...candidates.values()]
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id))],
    construction_rule_digest: rules.construction_rule_digest,
    exclusion_records: exclusion_records.sort((a, b) => a.contract_digest.localeCompare(b.contract_digest))
  };
  return { ...body, digest: digest(body) };
}
