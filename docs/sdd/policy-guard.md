# Policy Guard

Deterministic execution governance. **Jev chooses. The Guard validates. Codex
executes. Root verifies.**

## Authority

- The Guard has unconditional **veto** authority over any RoutePlan.
- The Guard has **no alternate-routing authority**. It never selects or
  substitutes a model, agent, lane, or capability. It never downgrades a plan
  silently. Its only fallback is Root: `DENY(reason) → Root executes`.
- The Guard is a validator, not a router. The old Policy-as-selector (fixed
  Luna/Terra shape mapping) is superseded (ADR 0013).

## Checks

The Guard verifies at least:

1. RoutePlan schema valid.
2. Route confidence meets the frozen requirement.
3. Requested capability exists in the Capability Catalog (evidence not
   `UNKNOWN`).
4. Requested model exists and supports the requested effort.
5. Requested context mode is supported (continuation only with a provable
   target).
6. Task ownership is bounded (capsule-owned paths resolve, non-overlapping).
7. User authorization covers the action class and side-effect class.
8. Verification is concrete (pre-run commands exist; non-empty).
9. Every writable target has a recoverable baseline.
10. Permission set is least-privilege enough (no broad writes for a
    single-file unit).
11. No unauthorized external side effect (push, PR, messaging, network writes
    beyond authorization).
12. No forbidden child delegation/fan-out.
13. Benchmark profile permits automatic routing for this task shape.
14. Attempt budget remains (economic ceiling respected; hard ceiling not
    exhausted).
15. Review budget remains.
16. Continuation target is genuinely observable if requested.

Each failing check yields a stable `DENY` reason code for the receipt.

## Verdicts

```text
ALLOW(RoutePlan)   — execute exactly the plan
DENY(reason) → Root
```

`DENY` never produces a modified plan. Root decides what to do: execute
directly, fix the capsule, or re-route with new information.

## Independence rules

- The Guard MUST NOT read Dashboard, ccusage, credit estimates, quota, model
  mix, or latency data. Those are observers.
- The Guard's confidence floor and qualification thresholds are frozen per
  benchmark release; they are never tuned per task at runtime.
- The Guard never trusts worker self-report; it validates *before* execution
  and hands the requested-vs-observed comparison to the lifecycle layer.
