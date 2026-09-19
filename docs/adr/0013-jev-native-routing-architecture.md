# ADR 0013: Jev-native routing architecture

Date: 2026-09-19
Status: Accepted
Supersedes: parts of ADR 0012 and the intermediate "Jev companion" conclusions
    recorded in the staged vNext documents on `codex/jev-companion`
Retained: ADR 0011 (child tuple per spawn), most of ADR 0012's template gate

## Context

ADR 0012 froze the delivery gate as a template with three mechanical checks and
no cost estimate, and made the fixed LUNA/TERRA tuple table the route selector.
A subsequent intermediate revision made Jev an optional advisory that could
neither select nor veto, and deferred Jev until a fixed Root + leaf
architecture proved value.

A JevRouter-type system changes the calculus. Jev (TypeSafe's System One
decision model) returns typed choices with calibrated probabilities and
confidence — a fast, cheap, structured routing brain. Keeping Jev advisory, or
keeping deterministic shape heuristics (`single-file → Luna`,
`everything else → Terra`) inside Policy, leaves the route decision to a
hand-written classifier that cannot represent uncertainty, cannot expand to
agents/Skills/MCPs, and cannot improve from evidence.

Research confirms the upstream split of concerns: JevRouter itself states
"Jev owns the decision probabilities; JevRouter owns availability, permissions,
risk and confirmation." Sol-advisor contributes the trust model (parent
verification → fresh review → parent finalization, observed isolation tiers,
context-preserving correction).

## Decision

The architecture resets to five roles:

1. **Frontier Root** — supervisor/architect/verifier. Owns requirements,
   ambiguity resolution, architecture, decomposition, Task Capsule authoring,
   final verification, acceptance, external actions. Root contains no route
   selection heuristic.
2. **Jev** — the only automatic route-selection intelligence. Selects
   execution location (root vs delegate), model, reasoning effort, agent,
   context strategy, and (in later slices) Skills/MCPs/tool scopes — from a
   truthful Runtime Capability Catalog.
3. **JevAdapter** — the thin seam between the repository and the TypeSafe Jev
   API (`POST /v1/systemone`); the only place Jev's wire schema appears.
4. **Policy Guard** — deterministic validator. Jev chooses, the Guard
   validates, Codex executes, Root verifies. The Guard has unconditional veto
   and **no alternate-routing authority**: on rejection it returns Root, never
   a different route.
5. **Codex native runtime** — executor substrate (`spawn_agent`, per-spawn
   model/effort overrides, Skills, MCPs, sandboxes, continuation surfaces).

Failure semantics: Jev unavailable/malformed/low-confidence → automatic
delegation unavailable → **Root executes**. Guard rejection → Root executes.
Execution-contract violation → restore, Root takeover. No heuristic fallback
routes exist anywhere.

## What remains valid from ADRs 0011/0012

- **ADR 0011 (supply the child tuple per spawn): retained.** Codex execution
  still receives model, effort, and `fork_turns: none` per spawn. The *tuples*
  stop being a fixed Policy-owned table and become RoutePlan fields validated
  against the Capability Catalog, but the mechanism is unchanged.
- **ADR 0012 (gate delegation with a template, not a cost estimate): the
  template and its three mechanical checks remain; the runtime cost-prediction
  prohibition remains.** What is superseded:
  - the fixed tuple table as the *selection* mechanism;
  - the "no separate economic decision" framing — selection passes through
    benchmark-qualified economics, evaluated before routing via frozen
    qualification data, never as runtime token forecasting;
  - "Implementation work is delegated by default" — nothing delegates by
    default; Jev decides and the Guard validates;
  - `routing-policy.md` as the route *selector* — it becomes the Guard
    contract; Jev is the selector.

Also superseded: every "Jev is advisory-only / not a core component /
experiment-only" conclusion from the intermediate staged documents.

## Consequences

- Automatic routing requires a Jev RoutePlan the Guard accepts; no Jev means
  Root execution — degraded, not broken.
- Route quality is bounded by the Capability Catalog: Jev cannot select what
  the runtime does not actually have.
- Savings claims remain benchmark-gated (ADR 0012's spirit, kept).
- The five-dispatch budget becomes a three-execution hard ceiling with a
  two-execution automatic economic ceiling; a third execution requires explicit
  benchmark qualification for that task profile.
- One Decision Receipt per routed attempt makes routing auditable without
  becoming routing authority.

## Non-goals preserved

No heuristic model router, no multi-provider framework, no second selector in
Policy, no quota-driven routing, no silent capability substitution, no savings
claims before benchmark qualification, no speculative provider abstraction
beyond the single Jev adapter.
