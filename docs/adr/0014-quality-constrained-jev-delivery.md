# ADR 0014: Quality-constrained Jev delivery

Date: 2026-09-20
Status: Accepted
Amends: ADR 0013 (closure semantics, economics objective, projection
    discipline, phasing gate); retains ADR 0013's central authority split —
    Jev chooses, the Guard validates, Codex executes, Root verifies.

## Context

An independent architecture review approved the ADR 0013 direction with
changes. Seven blockers, all documentation-level, would each have caused an
implementing agent to build the wrong architecture:

1. The benchmark's primary objective (minimize raw total tokens) did not
   match the product objective (move expensive frontier execution to cheaper
   execution). A correct routing that trades 100k flagship tokens for 170k
   cheap-model tokens would have been judged a failure.
2. Routing closure was Main-Task-scoped for unit-level events: one unit's
   Guard DENY or Jev root choice would permanently starve every sibling
   unit's delegation.
3. Task sequencing allowed writable delegated execution in P3 while
   isolation, recovery, review and publication only arrive in P4.
4. The Skill's step order placed baseline capture after Guard validation,
   making Guard check 9 (isolated baseline exists) unsatisfiable as written.
5. Free-text `RoutingProjection` summaries let Root implicitly shape Jev's
   choice — a hidden second selector at the projection seam.
6. plan/task still described a Choice/Score/Noul question batch, drifting
   from the V1 single-Choice spec.
7. Capability discovery wording treated file presence and `tools/list` as
   capability truth.

## Decision

1. **Economics.** Hard quality constraint first. Primary economic endpoints
   are paired reductions in frozen-price-weighted delivery cost and in
   frontier-capacity consumption; raw total tokens, latency, retry rates and
   model share are secondary. Price weights are frozen per benchmark release
   and used only by the benchmark — runtime routing and the Guard never see
   prices. A cheap-token increase with weighted-cost/flagship reduction is
   success.
2. **Two-layer routing state.** `MainTaskRoutingState (OPEN|CLOSED)` and
   `TaskUnitRoutingState (OPEN|ROOT_DIRECT|DELEGATED|ACCEPTED|CLOSED)`.
   Unit-level events (Jev root, DENY, provider failure, low confidence,
   unsafe projection, attribution closure, unit cancellation) close only the
   current unit. The Main Task latch is reserved for: safety or
   permission-scope violation; lost lifecycle state or counter corruption;
   competing routing authority; authorization ambiguity; exhausted global
   worker-execution budget; invalidated host trust. Counters stay
   Main-Task-scoped and monotonic; semantic decisions cap at 2 per unit.
3. **Execution gating.** P3 runtime integration is read-only probes under a
   code-level `execution_mode: "probe_read_only"` gate. `delegated_write` is
   unconstructible until baseline, isolation, restore, verification, review
   and publication all exist (acceptance case A33).
4. **Canonical order.** Capsule → authorization → baseline → pre-run
   verification → catalog → projection → Jev → Guard → execute. The Skill
   states this order; Guard check 9 is satisfiable as written.
5. **Deterministic projection.** `task_traits` are computed from observable
   capsule facts by a versioned rule; summaries are free English except
   route-directed vocabulary (difficulty, recommended model/lane,
   cheap/expensive, simple/complex, delegate/root, strong/weak model) is
   banned — a projection containing it is UNSAFE_PROJECTION. Root describes;
   only Jev chooses.
6. **One Choice.** V1 sends exactly one Choice over complete candidate IDs.
   plan/task now match the spec; Score/Noul exist nowhere except the
   Task 27 supervision candidate. Exceeding 255 options closes routing to
   Root in V1; a qualified hierarchy is future work requiring its own
   qualification regime.
7. **Evidence ladder.** DISCOVERED → REQUESTABLE → ENFORCEABLE → APPLIED.
   Selectability requires ≥ REQUESTABLE plus claimed ENFORCEABLE properties;
   file presence or `tools/list` proves only DISCOVERED.

## Consequences

- Benchmark qualification can now certify the outcome the product actually
  wants; economics remain frozen-release-only.
- Multi-unit Main Tasks keep delegation opportunity across sibling units
  while safety latches remain total.
- No writable delegated execution can exist before the recovery chain.
- The projection seam cannot regrow a selector; projection schema changes
  invalidate qualification bindings.
- This ADR completes ADR 0013; ADR 0013's authority split is unchanged.
