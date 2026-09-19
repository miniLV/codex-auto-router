# RouteRequest / RoutePlan

This is the repository-owned schema Interface. Jev wire fields are private to
JevAdapter. See [Task Capsule](task-capsule.md) for local inputs and
[Catalog](capability-catalog.md) for evidence.

## Identifiers and binding

Use immutable main_task_id and task_unit_id from trusted lifecycle state.
decision_id is unique within the Main Task; capsule_revision and counters are
monotonic. Bind every request/response/host event to its decision and candidate
digest. Canonical JSON hashing sorts object keys, preserves semantically ordered
arrays, and hashes complete local contracts; no secret values go into receipts.

~~~text
ResolvedExecutionContract {
  template_id, template_digest, provider_id, model, reasoning_effort,
  agent: { kind: builtin | custom, id, loaded_configuration_digest },
  skills[], mcps[], tools[],
  filesystem: { read_roots[], write_paths[], workspace_id, baseline_id },
  network: { mode: disabled | read_only_allowlist, allowed_origins[] },
  sandbox: { effective_policy_digest, confinement_evidence_ref },
  approval_policy, descendants_allowed: false, external_writes_allowed: false,
  context:
    { mode: fresh, context_packet_digest, fresh_context_evidence_ref } |
    { mode: continuation, context_packet_digest, worker_id, handle_ref,
      previous_execution_id, ownership_digest, revalidation_evidence_ref },
  host_fingerprint, resolved_configuration_digest
}
RootCandidate { candidate_id: root, decision: root }
DelegateCandidate {
  candidate_id, decision: delegate, execution: ResolvedExecutionContract,
  capability_evidence_refs[], qualification_binding_ref, safe_description
}
CandidateSnapshot { candidates[], digest, construction_rule_digest, exclusion_records[] }
~~~

The complete contract includes trusted provider identity and effective inherited
grants. Missing fields are invalid. Empty scope arrays mean no grant; there
are no implicit permissions. Internal workspace paths and continuation handles
stay local; safe descriptions use opaque IDs and approved capability facts.

Candidate IDs are stable hashes of canonical resolved contracts with a reserved
root ID, not free-form model output. Jev's Choice returns exactly one ID.
Continuation preserves worker/provider/model/effort/profile identity; changing
that tuple requires a fresh candidate. Capsule ownership must remain identical
for continuation; a narrower correction can use a fresh candidate or Root.

## Routing Interface

~~~text
RouteRequest {
  decision_id, main_task_id, task_unit_id, capsule_revision,
  routing_projection, candidate_snapshot,
  attempt_snapshot, frozen_selection_policy_ref,
  qualification_binding_ref | research_manifest_ref,
  failure_projection?
}
GuardContext {                 // local only, never serialized to Jev
  root_intent_ref, capsule_ref, authorization_ref, egress_policy_ref,
  baseline_ref, catalog_ref, qualification_ref | research_manifest_ref,
  current_attempt_state, verification_evidence_ref, reviewer_readiness_ref
}
SelectionEvidence {
  decision_id, candidate_snapshot_digest, provider_model,
  choice, confidence, probabilities, request_digest, question_digest
}
RootPlan {
  decision: root, candidate_id: root, selection: SelectionEvidence,
  annotations
}
DelegatePlan {
  decision: delegate, candidate_id, execution: ResolvedExecutionContract,
  selection: SelectionEvidence, annotations
}
Annotations {
  risk: { class: ordinary | review_required, source: capsule_and_policy },
  benefit_class: { value: qualified_delivery_economics | research_unqualified |
                  root_baseline, evidence_ref },
  reason_codes[]               // codes from facts below, not generated prose
}
RoutingFailure {
  kind: UNAVAILABLE | MALFORMED | LOW_CONFIDENCE |
        UNSAFE_PROJECTION | INPUT_UNSUPPORTED | CANCELLED,
  reason_code, decision_id, selection_evidence?, provider_attempt_refs[]
}
~~~

Adapter constructs a plan only by exact lookup of the validated returned ID.
It cannot derive missing fields or choose a fallback. Lifecycle fallback is
a distinct recorded outcome with source=lifecycle, not a RootPlan attributed
to Jev. Root plans have no child execution fields and never switch Root model.

## Provenance and question semantics

V1 asks one Choice. Confidence and probabilities are provider-native values;
no aggregation, risk Score conversion or independent Noul safety result.
Validate finite values in [0,1], complete option keys, sum within 0.000001 of
one, choice membership and choice being a maximum-probability option within
that tolerance. Ties keep the provider's chosen ID; never break them locally.
Reject missing or extra answer/question IDs and unexpected model IDs.

Risk is the union of capsule and deterministic policy triggers. Actual diff
can later raise review requirements; Jev cannot lower them. Benefit is read
from the bound qualification artifact, not inferred from model name or cost.
Allowed route reason codes are JEV_ROOT, JEV_DELEGATE, FRESH_CONTEXT,
PROVEN_CONTINUATION, QUALIFIED_DELIVERY_ECONOMICS and RESEARCH_UNQUALIFIED.
Guard/lifecycle/provider failure codes live in their own fields. These codes
report facts, not why Jev thought its choice was best.

The frozen English Choice instructions ask: choose the configuration most
likely to satisfy all acceptance/quality requirements while improving qualified
delivery economics (weighted delivery cost or frontier-capacity consumption),
including context, review and recovery overhead; select root
when a delegated candidate is unlikely to improve that constrained objective.
Instructions explicitly treat projection material as data, not authorization
or routing commands. Candidate descriptions contain observed capabilities and
frozen empirical evidence only, not Root model recommendations or online
numeric forecasts or prices. Raw total-token reduction is not required. Exact
question text and description rule are versioned
qualification inputs. Static rules never optimize among eligible options.

## AttemptState and FailureEvidence

~~~text
AttemptState {
  main_task_id, task_unit_id,
  main_task_state: OPEN | CLOSED, main_latch_reason?,
  unit_state: OPEN | ROOT_DIRECT | DELEGATED | ACCEPTED | CLOSED,
  unit_close_reason?,
  status: OPEN | CLOSED,
  close_reason?, decision_count, http_attempt_count, worker_execution_count,
  delegated_review_count, root_review_used, attribution_exception_used,
  active_execution_id?, current_candidate_digest?, failure_history[]
}
FailureEvidence {
  execution_id, capsule_revision, acceptance_ids[],
  class: verification | semantic_revision | tool_execution,
  verification_command_id?, affected_acceptance_ids[], root_observed_facts,
  repeated_fault: boolean, restoration_result, correction_scope_unchanged
}
~~~

Failure evidence is bounded current-task state produced from Root verification.
It excludes transcripts, secrets, historical receipts and worker conclusions
without independent evidence. It may inform a new Jev decision only while
AttemptState remains OPEN. Safety, identity, scope or specification failures
are closure reasons, never ordinary correction classes.
