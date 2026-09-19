# Upstream research: Foreman

Evidence report — not normative. Facts below are OBSERVED from the repository
README and docs (<https://github.com/thruwire/foreman>, `main` HEAD, 6
commits, inspected 2026-09-19). License: MIT (no code copied).

## Record

| Field | Value |
| --- | --- |
| URL | <https://github.com/thruwire/foreman> |
| License | MIT |
| Language | Python 3.11+, native `asyncio` runtime |
| Jev SDK | `typesafe-sdk`, `AsyncTypeSafeClient`, model `jev-latest` |
| Maturity | Self-described "architectural experiment, not a production software factory" |

## What it actually is

A standalone supervisor process that wraps a Codex coding worker with a
concurrent Jev assessment loop:

- **Worker loop**: a real Codex App Server thread/turn (`codex app-server`,
  `thread/start → turn/start → turn/steer | turn/interrupt`), with an
  `exec` fallback backend that cannot steer.
- **Foreman loop**: debounced (≥5s, periodic 30s) semantic assessment. One
  Jev call carries nine `Noul` questions in parallel: five job-level
  (`implementation_complete`, `tests_sufficient`, `requirements_satisfied`,
  `needs_verification`, `ready_to_finish`) and four floor-level
  (`meaningful_progress`, `worker_stuck`, `work_off_track`, `needs_human`).
- **Observations are bounded**: 20k-char diff, 12k-char output tails, 30
  recent events, 10 workers of history; the repository is never dumped into
  Jev.
- **Deterministic Python policy** maps probabilities to a small action
  vocabulary (`CONTINUE`, `START_WORKER`, `START_VERIFIER`, `STEER_WORKER`,
  `STOP_WORKER`, `RETRY_WORKER`, `FINISH`, `ESCALATE`) with safety-first
  ordering and fixed thresholds (0.65–0.85), steering/retry/iteration/worker
  caps (`FOREMAN_MAX_WORKERS=3`, `MAX_RETRIES=1`, `MAX_ITERATIONS=20`).
- **Live steering**: Jev-informed guidance can be injected into the active
  Codex turn; a stuck worker is steered once, given a grace period, then
  stopped and retried.
- **Persistence**: per-repo `.foreman/runs/<id>/state.json` + append-only
  `events.jsonl`; deterministic offline demo and test suite.
- **Honesty**: an explicit "claims this repository does not establish"
  section (no accuracy/calibration/safety claims; no proof `FINISH` means
  correct).

## Positioning versus Jev Auto Router

Orthogonal use of the same model. Foreman's Jev is a **process state
estimator** ("is the work stuck/off-track/complete?") with zero decision
authority — Python owns every action. Our Jev is the **route selector**
("who executes, with which model/effort/agent/context?") with a validating,
veto-only Guard. Foreman supervises execution *in flight*; we govern
selection *before* dispatch and judge the artifact *after* completion.

| Axis | Foreman | Jev Auto Router (this repo) |
| --- | --- | --- |
| Jev role | Semantic supervision (9 Noul estimates) | Route selection (Choice/Score/Noul → RoutePlan) |
| Jev authority | None — deterministic Python policy decides | Selection — deterministic Guard validates (veto, no alternates) |
| When | Continuous, concurrent, mid-flight | Once per routable unit, before dispatch; judgment at boundaries |
| Verification | Verifier worker gated by a `needs_verification` score; evidence-only, no formal proof | Root mechanical verification mandatory; risk-triggered fresh review with observed isolation tiers |
| Recovery | Stop/steer/retry the live worker | Baseline capture, restore-first, evidence-driven re-route, budgets 3/2 |
| Attribution | Not modeled | Requested-vs-observed contract; UNKNOWN never MATCH |
| Persistence | `state.json` + `events.jsonl` per run by default | Ephemeral by default; sanitized receipts only in benchmark mode |
| Economics | No claims; calibration is future work | Benchmark-gated: quality non-inferiority before economics; claims forbidden pre-qualification |
| Form | External Python orchestrator beside Codex | Codex-native plugin contract interpreted by Root (runtime code P2–P4) |
| Model pinning | `jev-latest` alias | Pinned `jev-1.13.0`, alias drift → `MALFORMED` |

## Concepts worth adopting

1. **`turn/steer` as continuation evidence (P4 input).** Foreman's App Server
   transport demonstrates an addressable, steerable in-flight Codex thread.
   This is exactly the kind of observable handle our continuation proof
   (delivery-lifecycle §correction) requires: capability discovery in Task 10
   should probe for a steer/resume surface, and only its observation would
   put `continue_same_worker` in the catalog.
2. **Bounded observation budgets as explicit config.** Their numeric caps
   (diff/tail/event limits) are a good pattern for the Task Capsule size
   budget that Task 5 must measure.
3. **Parallel Noul batch in one call** — independently validates our adapter
   design (one call, many typed questions).
4. **Their evaluation honesty** ("what Foreman proves" / "does not
   establish") mirrors our claims discipline; a good calibration-curve idea
   for our P6 benchmark reporting.
5. **Deterministic offline demo.** Their `foreman demo` exercises runtime,
   policy, persistence, and UI with fake model and worker, no keys or
   network — the pattern our benchmark harness (Task 22) should copy as a
   deterministic dry-run arm.
6. **Anti-oscillation state.** Steering caps, grace periods, and
   verification/steering history that prevent policy flapping — required
   discipline for any future supervision-triggered takeover (see below).

## Combining the designs: a supervision slice (candidate, not normative)

Foreman exposes our one genuine blind window: between a Guard-ALLOWed
dispatch and the worker's return, we have no signal — immediate-takeover
conditions (spec §12) can only fire at boundaries. A Foreman-shaped
**supervision slice** could close it under our invariants:

- **Precondition**: the host exposes an observable execution channel
  (App Server notifications or equivalent) — a catalog entry with `OBSERVED`
  evidence; a silent child is acceptable and simply unsupervised.
- **Observation**: bounded, config-typed evidence (diff cap, output tails,
  recent events, elapsed time); never a repo dump.
- **Assessment**: one parallel Jev Noul batch per debounced window
  (`worker_stuck`, `work_off_track`, `meaningful_progress`) — Jev estimates;
  it never selects anything here.
- **Deterministic control (ours)**: frozen thresholds, anti-flap grace
  period, outcomes exactly `CONTINUE | STEER | TAKEOVER`.
- **STEER** is the `continue_same_worker` mechanism over a proven handle:
  Root authors the guidance text (Jev cannot); a steered execution is still
  one execution; steer cap 1 per execution.
- **TAKEOVER** is an immediate takeover: latches routing closed (acceptance
  case A10), restore when needed.
- **Invariants**: supervision output is lifecycle input only — never a
  routing input, never lowers review requirements (may raise them, which
  route-plan.md already permits); assessments count as route overhead in
  receipts; the slice ships OFF and requires its own benchmark qualification
  (false-positive takeovers are the risk Foreman itself admits).
- **V1 scope**: not included. V1 is the single-Choice routing slice; this is
  a post-P6 candidate with its own acceptance cases.

## Concepts deliberately NOT copied

- **Jev-as-advisor control split for routing.** Foreman's Jev never decides
  anything; for our selection axis that shape is superseded (ADR 0013). We
  share their instinct that *safety bounds stay deterministic* — expressed
  as our Guard — but selection authority stays with Jev.
- **Mid-flight steering of workers.** Conflicts with our fresh-context,
  one-child, verdict-integrity model (any post-verdict mutation voids it).
  Could become a gated P5+ experiment only under proven continuation and
  would still count as a new candidate for review purposes.
- **Default persistent run state.** Our normal routing state is ephemeral;
  receipts are evidence and never routing authority. Persistence exists only
  in benchmark/research mode.
- **Supervision signals as routing inputs.** A future in-flight "stuck /
  off-track" assessment may inform *immediate-takeover* decisions (lifecycle,
  spec §12) but must never feed route selection or the Guard.
