import { buildCatalog, constructCandidates, type CandidateRules, type Evidence, type ExecutionContract } from "../src/catalog.js";

export const host = { session_id: "session", fingerprint: "host", configuration_digest: "config" };
export const now = 100;
export const evidence = (id: string, level: Evidence["level"] = "REQUESTABLE"): Evidence => ({
  id, level, class: "OBSERVED", source: "trusted_host", host, observed_at: 0, valid_until: 1000
});
export function execution(): ExecutionContract {
  return {
    template_id: "template", template_digest: "template-digest", provider_id: "provider",
    model: "model", reasoning_effort: "medium",
    agent: { kind: "builtin", id: "worker", loaded_configuration_digest: "profile" },
    skills: [], mcps: [], tools: [],
    filesystem: { read_roots: ["src"], write_paths: ["src/file.ts"], workspace_id: "isolated", baseline_id: "baseline" },
    network: { mode: "disabled", allowed_origins: [] },
    sandbox: { effective_policy_digest: "policy", confinement_evidence_ref: "confinement" },
    approval_policy: "never", descendants_allowed: false, external_writes_allowed: false,
    context: { mode: "fresh", context_packet_digest: "packet", fresh_context_evidence_ref: "confinement" },
    host_fingerprint: "host", resolved_configuration_digest: "configuration"
  };
}
export const rules: CandidateRules = {
  construction_rule_digest: "construction", qualification_binding_ref: "qualification",
  authorized_reads: ["src"], owned_writes: ["src/file.ts"], allowed_origins: [],
  qualify: () => true, describe: () => "Authorized isolated file update.", continuation_proven: () => false
};
export function catalog() {
  return buildCatalog({ host, generation: 1, evidence: [evidence("template"), evidence("confinement", "ENFORCEABLE")],
    entries: [
      { id: "provider/model", kind: "model", content_digest: "model", evidence: evidence("model"), effects: [] },
      { id: "worker", kind: "agent", content_digest: "profile", evidence: evidence("agent"), effects: [] },
      { id: "fresh", kind: "context", content_digest: "fresh", evidence: evidence("fresh"), effects: [] }
    ], templates: [{ id: "template", digest: "template-digest", evidence_ref: "template",
      enforcement_refs: ["confinement"], configurations: [execution()] }] });
}
export const snapshot = () => constructCandidates(catalog(), rules, now);
