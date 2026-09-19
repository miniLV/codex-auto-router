# Benchmark contract

The system cannot claim savings merely because Jev routes to a cheaper model.
The benchmark tests the **whole delivery cycle**: routing + capsule + execution
+ verification + review + retries + restores.

## Arms

| Arm | Definition |
| --- | --- |
| A | Pure frontier Root |
| B | Same-session / JevRouter-style routing when reproducibly available |
| C | Jev Auto Router |

Optional ablations: C-minus-review, C-minus-continuation, C model-only,
C full-capability routing.

If arm B cannot be executed reliably in an environment, record it as
unavailable for that environment rather than fabricating a comparison.

## Quality first

Measured at minimum: completion rate, blinded acceptance, critical
regressions, security/interface defects, human interventions, restore rate,
retry rate.

**Quality non-inferiority passes before any economics is evaluated.**

## Economics (only after quality passes)

Total tokens, flagship tokens, cached input, uncached input, output tokens,
reasoning tokens, route overhead, capsule overhead, review overhead, retry
overhead, P50/P95 cost proxy, P50/P95 latency.

- Subscription quota percentage is not automatically convertible to per-task
  model cost; quota measurements are exploratory.
- Unknown routing attribution cannot count as verified savings. Runs with
  `routing_metadata_unobservable` or mismatch states are excluded from
  verified savings and reported separately.

## Strata

At minimum: tiny edit, single-file mechanical, multi-file mechanical, test
repair, refactor, public API change, config change, dependency change,
ambiguous requirement, debugging, large-context task, semantic/judgment-heavy
task. Paired tasks from identical repository baselines.

## Anti-p-hacking (frozen before holdout)

- Freeze: corpus, strata, metrics, thresholds, exclusion rules, rerun rules.
- Failures and timeouts count as runs.
- Publish every stratum, including losing ones.
- No mid-run threshold tuning; deltas estimated from pilot variance first.

## Qualification artifact

Versioned at `docs/benchmarks/qualification.json` (created only when evidence
exists):

```json
{
  "benchmark_version": "TBD",
  "profiles": {
    "example_profile": {
      "quality_non_inferior": true,
      "economic_margin_positive": true,
      "automatic_routing_allowed": true
    }
  }
}
```

The Guard reads qualification semantics from this artifact's schema; profiles
without evidence are automatically-routing-denied. No production entry is
invented before evidence exists.

## Honest claims

Routing accuracy benchmarks (e.g., upstream JevRouter's tool-call prediction)
do not imply end-to-end delivery value. The defensible claim discipline lives
in `spec.md` §product-claims.
