# Decision Receipt

An auditable evidence record per routed attempt. Receipts are **evidence,
never routing authority**: nothing reads a receipt to decide a future route.

## Contents

```text
task_unit_identity / digest
capability_catalog_digest
jev_request               (normalized RouteRequest digest)
route_plan                (normalized, as decided by Jev)
jev_confidence
risk
benefit_class
reason_codes[]
guard_verdict             (ALLOW | DENY + rejection reason)
requested_execution_contract
observed_execution_contract  (state class per tracked dimension)
attempt_index
continuation_mode
verification_result
review_tier               (ENFORCED_READ_ONLY | BEHAVIORALLY_READ_ONLY |
                           REVIEW_UNAVAILABLE | none)
review_verdict
restore_or_takeover
final_outcome
token_usage               (by role: root, worker, reviewer)
cached_input / uncached_input
reasoning_usage
latency
```

## Retention policy

- Normal routing state stays **ephemeral**: receipts may be surfaced in-task
  (for Root's report to the user) but are not persisted as routine state.
- **Benchmark/research mode** may persist sanitized receipts (no secrets, no
  user content) as the qualification artifact's raw evidence.
- Append-only where persisted; rerunning a route creates a new receipt.

## Rules

1. A receipt never feeds a routing decision. No feedback loop, no adaptive
   thresholds from receipts.
2. A run with `routing_metadata_unobservable` or any mismatch state is flagged
   in the receipt and **excluded from verified-savings evidence** even when
   adopted.
3. Receipt hashes (catalog digest, request digest) make any decision
   reproducible against the exact inputs it was made from.
