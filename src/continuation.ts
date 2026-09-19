import { digest } from "./canonical.js";
import { evidenceValid, type Evidence, type ExecutionContract, type HostIdentity } from "./catalog.js";

export interface ContinuationEvidence {
  host: HostIdentity; evidence: Evidence; worker_id: string; handle_ref: string;
  previous_execution_id: string; previous_contract: ExecutionContract;
  ownership_digest: string; restored_baseline_digest: string; worker_stopped: boolean;
  acceptance_digest: string; previous_acceptance_digest: string;
}
export function continuationProven(next: ExecutionContract, proof: ContinuationEvidence, now: number): boolean {
  const context = next.context;
  if (context.mode !== "continuation" || !proof.worker_stopped || !proof.restored_baseline_digest ||
    !evidenceValid(proof.evidence, proof.host, now) || proof.acceptance_digest !== proof.previous_acceptance_digest ||
    context.worker_id !== proof.worker_id || context.handle_ref !== proof.handle_ref ||
    context.previous_execution_id !== proof.previous_execution_id || context.ownership_digest !== proof.ownership_digest ||
    context.revalidation_evidence_ref !== proof.evidence.id || next.host_fingerprint !== proof.host.fingerprint) return false;
  const identity = (c: ExecutionContract) => ({ provider: c.provider_id, model: c.model, effort: c.reasoning_effort,
    agent: c.agent, skills: c.skills, mcps: c.mcps, tools: c.tools, filesystem: c.filesystem,
    network: c.network, sandbox: c.sandbox, approval: c.approval_policy, template: c.template_digest,
    descendants: c.descendants_allowed, external: c.external_writes_allowed, host: c.host_fingerprint });
  return digest(identity(next)) === digest(identity(proof.previous_contract));
}
