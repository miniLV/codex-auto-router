# Benchmark harness

A separate diagnostic harness. It imports the runtime Modules but the runtime
never imports it: no `src/` file may reference `bench/`, so the harness cannot
become a route-selection or control path.

## Arms

| Arm | Meaning |
| --- | --- |
| A | Pure frontier Root, unchanged acceptance and governance |
| B | Same-session routing when reproducibly available; recorded `unavailable` here rather than fabricated |
| C | This full Jev policy: catalog → one Choice → Guard → isolated execution → verification → review → publication |

Tasks are paired from identical baseline fixtures and carry the same acceptance
standards in every arm. Frozen strata: `small-edit`, `root-choice`,
`security-review`, `correction`.

## Frozen metrics and thresholds

Primary endpoints (evaluated only after quality passes): paired reduction of
frozen-price-weighted delivery cost and of frontier-capacity consumption
(flagship input + reasoning tokens). Raw total tokens are secondary and may
legitimately increase. Price weights, flagship models, margins and the
one-sided `z` are frozen in `fixtures.ts` (`frozenConfig`); the runtime and the
Guard never see them.

Quality gates: completion, acceptance, zero critical defects, restore and retry
rates. Quality results are checked before any economic inference.

## Ablations

`full_policy` is the only qualifiable arm. `without_review`,
`without_correction` and `without_worker` are frozen diagnostic variants that
remove a gate or role; they can explain an effect but cannot qualify production
or stand in for C.

## Deterministic dry-run

`runDryRun` uses an injected fake Jev provider (`fetch` seam) and a fake
worker/verification surface with no API keys and no network. It exercises
routing, the Policy Guard, lifecycle transitions, correction and receipts
end-to-end and returns a replay digest stable across runs.

Anti-p-hacking rules are enforced by `configErrors` before any run: frozen
holdout, declared arms, intention-to-treat retention of all assignments,
pre-registered exclusions only, declared strata and ablations, and frozen price
weights and statistical plan.

## Qualification

This harness produces diagnostic dry-run evidence only. The production
qualification artifact (`docs/benchmarks/qualification.json`) is created only
from an independently checked evidence report; no passing example exists
before that evidence.
