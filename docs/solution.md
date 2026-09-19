# Jev Auto Router Architecture

The repository ships a static contract plus the seams of the Jev integration;
route selection itself is deliberately not implemented here. The
[Runtime Router Policy](../skills/jev-auto-router/references/routing-policy.md)
is the sole canonical runtime Module. This document explains the architecture
informally; `spec.md` is normative and `docs/sdd/` expands each subsystem.

## The five roles

```text
User
  → Frontier Root            supervisor / architect / verifier
  → Jev                      routing brain (sole automatic selector)
  → JevAdapter               the only seam to the Jev API
  → Policy Guard             deterministic validator (veto, no alternates)
  → Codex native runtime     executor substrate
  → Root verification        mechanical, then fresh review when triggered
  → Root final acceptance    deliver
```

**Frontier Root** owns requirements, ambiguity resolution, architecture,
decomposition, the Task Capsule, external actions, verification judgment, and
acceptance. Root is not a router: it contains no "single-file goes here,
everything else goes there" heuristic.

**Jev** is the routing brain — a strategic core dependency, not an advisory
companion. It selects root vs delegate, model, reasoning effort, agent,
Skills, MCPs, tool scope, context strategy, and continuation strategy, as
calibrated typed decisions with confidence. It cannot write code, specs, or
prose, which is exactly why Root authors the capsule and Jev only chooses.

**JevAdapter** is the single place Jev's wire schema appears. It serializes
the internal RouteRequest, normalizes responses into a RoutePlan, and maps
every provider failure to an explicit state. It is not a multi-provider
abstraction; Jev is the only provider, deliberately.

**Policy Guard** validates the plan deterministically: schema, confidence
floor, catalog existence, ownership bounds, authorization, verification,
baseline, least privilege, no external side effects, no fan-out, benchmark
qualification, and budgets. It has unconditional veto and zero
alternate-routing authority — `ALLOW(RoutePlan)` or `DENY(reason) → Root`,
never "Jev chose X but I choose Y".

**Codex native runtime** executes the accepted plan through native spawns
with per-spawn model/effort/agent/context, Skills, MCPs, sandbox surfaces, and
continuation surfaces where verifiably supported. No parallel generic agent
runtime is built.

## Decision flow

```text
Root condition + task nature
  → Task Capsule (five-section template, three mechanical checks)
  → Runtime Capability Catalog (observed evidence only)
  → RouteRequest → JevAdapter → Jev → RoutePlan
  → Policy Guard: ALLOW | DENY → Root
  → Codex native execution (one child, requested-vs-observed recorded)
  → Root mechanical verification
  → fresh independent review when triggered (observed isolation tier)
  → Root final acceptance | restore + bounded correction/takeover
```

`ROOT_DIRECT` is a first-class outcome — Jev may return `decision: root`, the
Guard may deny, or any failure may force it. Every failure path (Jev timeout,
malformed plan, low confidence, Guard denial, contract violation, exhausted
budget, competing routing authority) resolves to Root execution. The system
degrades; the user's task never breaks.

## Why this position is distinct

JevRouter-like systems put Jev in front of agent capabilities and stop at the
decision. Jev Auto Router accepts that overlap and adds the delivery trust
that a decision-only router does not have:

| Layer | JevRouter-like | Jev Auto Router |
| --- | --- | --- |
| Selection | Jev | Jev |
| Deterministic governance | availability/permissions/risk filters | Policy Guard with unconditional veto, no alternates |
| Handoff | candidate manifests | bounded Task Capsule (economic boundary, measured) |
| Capability truth | discovered manifests | Runtime Capability Catalog with evidence classes (`UNKNOWN` = absent) |
| Execution attribution | — | requested-vs-observed contract; UNKNOWN never MATCH |
| Recovery | — | baseline capture, restore-first, no invisible repair |
| Verification | — | Root mechanical verification; self-report never acceptance |
| Review | — | risk-triggered fresh semantic review, observed isolation tiers |
| Correction | — | structured failure evidence → Jev re-route; continuation only when proven |
| Economics | routing-accuracy benchmarks | whole-cycle benchmark, quality before savings, frozen qualification |

The core value proposition is **intelligent routing + trustworthy coding
delivery** — not "a smarter classifier".

## Product identity and history

The product was renamed from `codex-auto-router` to **`jev-auto-router`**
(see [ADR 0013](adr/0013-jev-native-routing-architecture.md) and the rename
runbook in [plan.md](../plan.md)). The intermediate design that made Jev an
optional advisor is superseded and exists only as history. An earlier design
that mapped task shapes to fixed Luna/Terra tuples is likewise superseded:
per-spawn tuples remain the *mechanism* (ADR 0011), but their values now come
from a Jev RoutePlan validated against the catalog.

## Benchmark compass

The benchmark measures the whole delivery cycle and is a separate harness,
not a copy of the Skill. Arms: A = pure frontier Root; B = same-session /
JevRouter-style routing when reproducibly available (recorded unavailable
otherwise); C = Jev Auto Router; ablations C-minus-review,
C-minus-continuation, C model-only, C full-capability. Quality
non-inferiority (completion rate, blinded acceptance, regressions, restore
rate, human intervention) must pass before any economics (tokens by class,
route/capsule/review/retry overhead, P50/P95 cost proxy and latency) is
evaluated. Corpus, strata, metrics, thresholds, and exclusion rules freeze
before the holdout; failures count; losing strata are published. Subscription
quota percentages are not per-task cost, and runs with unobservable or
mismatched routing attribution never count as verified savings. The full
contract lives in [docs/sdd/benchmark.md](sdd/benchmark.md).

## Validation and proof

`npm test`, `npm run typecheck`, and `git diff --check` validate the static
contract, including stale-identity and stale-architecture sweeps. They do not
prove that any runtime dispatch, Jev consultation, review, or cost saving
occurred; those require controlled, observed runs under the benchmark
contract above.
