import { digest } from "./canonical.js";
import { evidenceValid, type Evidence, type HostIdentity } from "./catalog.js";
import { isVerifiedCandidate, type VerifiedCandidate } from "./verification.js";

export interface ReviewRisk { persistent: boolean; public_interface: boolean; data_structure: boolean;
  security: boolean; permissions: boolean; judgment_calls: string[]; gaps: string[] }
export const reviewRequired = (r: ReviewRisk): boolean => r.persistent &&
  (r.public_interface || r.data_structure || r.security || r.permissions || r.judgment_calls.length > 0 || r.gaps.length > 0);
export interface ReviewPacket {
  main_task_id: string; candidate_id: string; producer: "root" | "worker";
  original_user_instruction_refs: string[]; root_intent_digest: string; acceptance_ids: string[];
  capsule_ref: string; full_diff_ref: string; final_candidate_manifest_digest: string;
  dependency_digest: string; verification: VerifiedCandidate; risk: ReviewRisk; constraints: string[];
}
export type ReviewTier = "ENFORCED_READ_ONLY" | "BEHAVIORALLY_READ_ONLY" | "REVIEW_UNAVAILABLE";
export interface ReviewVerdict {
  verdict: "ACCEPT" | "REVISE" | "RECONSIDER"; tier: ReviewTier;
  candidate_digest: string; dependency_digest: string; packet_digest: string; findings: string[];
}
const reviews = new WeakMap<object, string>();
export const reviewIsCurrent = (r: ReviewVerdict, candidate: string, dependencies: string): boolean =>
  reviews.get(r) === digest(r) && r.candidate_digest === candidate && r.dependency_digest === dependencies && r.tier !== "REVIEW_UNAVAILABLE";

export async function reviewCandidate(packet: ReviewPacket, input: {
  host: HostIdentity; now: number; confinement: Evidence; read_only?: Evidence; hard_read_only_required: boolean;
  model: string; effort: string; fresh: boolean; descendants_allowed: false; active_worker: boolean;
  reserve: (candidate: string, producer: "root" | "worker") => void;
  snapshot: () => Promise<{ candidate: string; dependencies: string; review_workspace: string }>;
  invoke: (packet: ReviewPacket) => Promise<{ verdict: "ACCEPT" | "REVISE" | "RECONSIDER"; findings: string[];
    source: "trusted_host"; model: string; effort: string; fresh: boolean; stopped: boolean }>;
}): Promise<ReviewVerdict> {
  const unavailable = (): ReviewVerdict => ({ verdict: "RECONSIDER", tier: "REVIEW_UNAVAILABLE",
    candidate_digest: packet.final_candidate_manifest_digest, dependency_digest: packet.dependency_digest,
    packet_digest: digest(packet), findings: ["REVIEW_EVIDENCE_UNAVAILABLE"] });
  try {
    if (input.active_worker || input.descendants_allowed !== false || input.model !== "gpt-6-astra" || input.effort !== "medium" ||
      !input.fresh || !evidenceValid(input.confinement, input.host, input.now, true) ||
      packet.original_user_instruction_refs.length === 0 || !packet.root_intent_digest || !packet.full_diff_ref ||
      !isVerifiedCandidate(packet.verification, packet.final_candidate_manifest_digest, packet.dependency_digest) ||
      !packet.acceptance_ids.every(id => packet.verification.acceptance_ids.includes(id))) return unavailable();
    const enforced = input.read_only !== undefined && evidenceValid(input.read_only, input.host, input.now, true);
    if (!enforced && input.hard_read_only_required) return unavailable();
    const before = await input.snapshot();
    if (before.candidate !== packet.final_candidate_manifest_digest || before.dependencies !== packet.dependency_digest) return unavailable();
    input.reserve(packet.final_candidate_manifest_digest, packet.producer);
    const result = await input.invoke(structuredClone(packet));
    const after = await input.snapshot();
    if (digest(before) !== digest(after) || result.source !== "trusted_host" || result.model !== "gpt-6-astra" ||
      result.effort !== "medium" || !result.fresh || !result.stopped || !["ACCEPT", "REVISE", "RECONSIDER"].includes(result.verdict)) return unavailable();
    const review: ReviewVerdict = { verdict: result.verdict, tier: enforced ? "ENFORCED_READ_ONLY" : "BEHAVIORALLY_READ_ONLY",
      candidate_digest: before.candidate, dependency_digest: before.dependencies, packet_digest: digest(packet), findings: [...result.findings] };
    reviews.set(review, digest(review)); return review;
  } catch { return unavailable(); }
}
