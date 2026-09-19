# Decision Receipt

Evidence per routing attempt and a task-level aggregate. Receipts never select
future routes. Normal routing state is ephemeral; only explicitly authorized
research persists approved sanitized evidence.

## Discriminated outcomes

~~~text
DecisionReceipt {
  schema_revision, main_task_id, task_unit_id, capsule_revision, decision_id?,
  root_intent_digest, capsule_digest, projection_digest?,
  candidate_snapshot_digest?, host_fingerprint?, qualification_binding?,
  question_digest?, provider_model_requested?, selection_evidence?,
  counters_before, counters_after,
  outcome:
    { kind: preflight_failed, reason } |
    { kind: adapter_failed, routing_failure } |
    { kind: guard_denied, reason } |
    { kind: root_selected, plan } |
    { kind: delegated, plan, execution_id } |
    { kind: candidate_rejected, execution_id, verification, review?, recovery } |
    { kind: candidate_adopted, execution_id?, disposition, verification,
      review?, integration } |
    { kind: pending, unmet_gate } |
    { kind: cancelled, cleanup_state },
  provider_attempts[],
  requested_contract?, observed_contract?, violations[], safety_evidence_refs[],
  review_packet_digest?, review_tier?, review_verdict?, candidate_digest?,
  integration_result?, final_task_status?, usage_refs[], sanitized_evidence_refs[]
}
ProviderAttempt {
  decision_id, attempt_index, started_at, finished_at, status,
  sanitized_error_code?, provider_request_id?,
  input_tokens: observed | UNKNOWN, output_tokens: observed | UNKNOWN,
  retry_after?, request_digest, response_model?, response_digest?
}
~~~

A preflight failure has no fictitious request, response, plan or confidence.
A malformed answer may retain safe diagnostic fields but cannot become a valid
plan. A low-confidence failure retains validated raw probabilities/confidence.
A lifecycle Root fallback is not a Jev root choice. Cancellation and pending
review/integration are not successful completion.

## Execution and accounting

Keep selectability evidence, requested values, actual application observations,
safety proof and adoption disposition separate. accepted_under_unobservable
does not overwrite routing_metadata_unobservable. Unobservable/mismatched
attribution is excluded from verified route-savings attribution, not removed
from whole-policy costs or quality outcomes.

Collect usage from authoritative provider/host observations for Root, workers,
reviewers, Jev and any paid probes, including failed/retried calls. Correlate
parent/child records by execution ID to avoid duplicate counting. Cached input
and reasoning usage are provider-defined subsets. UNKNOWN is never zero.
A task aggregate includes capsule/preflight and Root takeover usage outside
individual delegate attempts.

Root's live bounded FailureEvidence is a separate lifecycle value, assembled
from current verification. No component reads stored receipts, ccusage,
Dashboard or account history to choose a route or adjust thresholds.

## Privacy and replay

Never persist secrets, bearer credentials, full conversations, unrestricted
provider/error bodies or user content under a generic debugging flag. Candidate
IDs and error strings are validated before recording. Keep normal receipts
ephemeral and user-visible only within the authorized task.

Research may persist sanitized synthetic or explicitly approved redacted
fixtures, with retention scope established by its manifest. Store the exact
safe projection, candidate descriptions/resolved-template fixture, question,
selection policy, host fixture, expected response and semantic version/digests.
If safe replay content cannot be retained, label the record non-replayable;
do not retain secret originals because a hash was recorded.

Digests bind evidence and detect change; they cannot recover deleted content.
Replay has two meanings: deterministic fixture replay tests normalization and
lifecycle; a new live Jev call tests behavior and may produce a different valid
answer. Neither a hash nor a model pin promises identical stochastic output.
Minimum diagnostic evidence is required; a persistent telemetry system is not.
