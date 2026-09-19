# Upstream research: sol-advisor

Evidence report — not normative. The normative contract lives in `spec.md` and
`docs/sdd/`.

## Record

| Field | Value |
| --- | --- |
| URL | <https://github.com/DannyMac180/sol-advisor> |
| Commit/tag | `main` HEAD inspected 2026-09-19 (22 commits, branch `main`) |
| License | MIT (`LICENSE` at repo root) |
| Evidence classes | OBSERVED = README + repo layout fetched directly; earlier OBSERVED = this repository's own git history (ADR 0007–0010) derived from a prior revision of sol-advisor |

## What it actually is

A Codex-only workflow plugin where a frontier model (GPT-5.6 Sol / High) acts
as the architect: it declares a risk-gated route before any task tool call,
keeps `solo` as the default, and uses at most one auxiliary agent when that
improves delivery.

## Architecture (OBSERVED)

- Four modes declared by the parent before first tool call:
  - `solo` — default; Root plans, implements, tests, self-reviews.
  - `delegate` — one implementer: Luna/Max for bounded work, Terra/High for
    judgment-heavy/high-risk work; root verifies.
  - `audit` — Root implements; a fresh read-only Sol/High reviews.
  - `full` — explicit exception: implementer + root verification + fresh review.
- Route declaration is a `SELECTIVE ROUTE` statement with mode + risk rationale,
  emitted before the first task tool call.
- Escalation allowed only on newly observed risk; silent downgrades forbidden.
- Parent owns: architecture, decomposition, route selection, verification,
  escalation decisions, acceptance. Auxiliary substitutes for parent work; it
  never duplicates it.
- Fresh reviewer returns `ship | fix-first | rethink`; any fix requires a new
  review.
- Companion role installer is fail-closed: modified, unsafe, nonregular,
  symlinked, unknown, or differing files are left untouched.

## Concepts re-adopted deliberately

1. **Parent verification → fresh review → parent finalization.** Mechanical
   verification and semantic review are different responsibilities; the parent
   confirms the reviewed state is unchanged before final acceptance.
2. **Fresh independent reviewer** that judges both the diff *and* whether the
   specification itself was adequate, returning exactly one verdict.
3. **Isolation tiers from observed evidence**: enforced read-only only when the
   runtime policy proves it; behaviorally read-only (before/after state
   comparison) as a weaker but valid tier; review unavailable when neither can
   be demonstrated.
4. **State integrity**: any mutation after a semantic verdict invalidates it.
5. **Context-preserving correction** (continue with the original worker) — but
   only when runtime evidence proves the continuation handle, worker identity,
   ownership, and required model/runtime contract. Unprovable continuation is
   simply unavailable to the router.
6. **Risk-gated route declaration before work starts**, with escalation only
   forward and never silent downgrades.

## Intentionally NOT copied

- Fixed parent model as routing authority. Sol Advisor's parent *is* the
  selector; in our architecture the frontier Root is the supervisor and Jev is
  the routing brain. Root never contains a second route-selection heuristic.
- `solo` as the default mode. Our default is that *every* Main Task is
  considered by the router; the outcome may be Root execution, but selection is
  Jev's, validated by the Guard.
- Mode names (`solo/delegate/audit/full`) as a user-facing taxonomy. Our
  RoutePlan is a capability decision, not a mode label.
- Mandatory fresh Sol review for every delegated route (its `full` mode). Our
  review is risk-triggered and budget-bounded.

## Relevance to this repository's history

This repository's ADRs 0007–0010 recorded, then superseded, a structured
"Expected Sol Work Reduction" cost estimate derived from an earlier sol-advisor
revision. ADR 0012 replaced it with the template gate. The current design
supersedes *both* on the selection axis: neither a template heuristic nor a
parent-side reduction estimate selects routes; Jev does, subject to Guard
validation and benchmark-qualified economics.
