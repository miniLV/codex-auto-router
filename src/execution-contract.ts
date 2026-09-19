import { digest } from "./canonical.js";
import type { ExecutionContract } from "./catalog.js";
import type { NativeCompletion } from "./exec.js";

export type Observation = "requested_match" | "requested_mismatch" | "routing_metadata_unobservable";
export type Violation = "none" | "permission_scope_violation" | "context_boundary_violation";
export type Disposition = "not_adopted" | "accepted" | "accepted_under_unobservable" | "accepted_with_mismatch";
export interface ExecutionAssessment {
  requested: ExecutionContract;
  observed: Partial<ExecutionContract>;
  dimensions: Partial<Record<keyof ExecutionContract, Observation>>;
  observation: Observation; violation: Violation; disposition: Disposition;
  adoption_exception_eligible: boolean;
  action: "verify" | "verify_and_close_unit" | "stop_and_latch_main" | "reject_and_close_unit";
}

export function assessExecution(requested: ExecutionContract, completion: NativeCompletion): ExecutionAssessment {
  const observed = completion.observed;
  const dimensions: ExecutionAssessment["dimensions"] = {};
  let violation: Violation = "none", narrower = false;
  for (const key of Object.keys(requested) as Array<keyof ExecutionContract>) {
    const actual = observed[key];
    dimensions[key] = actual === undefined ? "routing_metadata_unobservable" :
      digest(actual) === digest(requested[key]) ? "requested_match" : "requested_mismatch";
    if (dimensions[key] === "requested_match" || key === "model" || key === "reasoning_effort") continue;
    if (key === "context" || key === "provider_id" || key === "host_fingerprint") { violation = "context_boundary_violation"; continue; }
    if (["skills", "mcps", "tools"].includes(key) && Array.isArray(actual) &&
      actual.every(x => (requested[key] as string[]).includes(x))) { narrower = true; continue; }
    // A missing safety dimension is unknown safety, not an attribution exception.
    violation = violation === "context_boundary_violation" ? violation : "permission_scope_violation";
  }
  if (completion.source !== "trusted_host" || completion.requested_digest !== digest(requested) || !completion.stopped)
    violation = "context_boundary_violation";
  const values = Object.values(dimensions);
  const observation = values.includes("requested_mismatch") ? "requested_mismatch" :
    values.includes("routing_metadata_unobservable") ? "routing_metadata_unobservable" : "requested_match";
  const exception = violation === "none" && !narrower && observation !== "requested_match";
  return { requested: structuredClone(requested), observed: structuredClone(observed), dimensions, observation, violation,
    disposition: "not_adopted", adoption_exception_eligible: exception,
    action: violation !== "none" ? "stop_and_latch_main" : narrower ? "reject_and_close_unit" : exception ? "verify_and_close_unit" : "verify" };
}

export function adoptAssessment(assessment: ExecutionAssessment, gates: {
  verified: boolean; required_review_passed: boolean; integrated: boolean; attribution_exception_available: boolean;
}): ExecutionAssessment {
  if (!gates.verified || !gates.required_review_passed || !gates.integrated || assessment.violation !== "none" ||
    assessment.action === "reject_and_close_unit" ||
    (assessment.adoption_exception_eligible && !gates.attribution_exception_available)) return assessment;
  return { ...assessment, disposition: assessment.observation === "requested_match" ? "accepted" :
    assessment.observation === "requested_mismatch" ? "accepted_with_mismatch" : "accepted_under_unobservable" };
}
