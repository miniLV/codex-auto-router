# Jev Auto Router — Task Board

Concrete tasks in execution order. Each task lists expected files, its
verification, and its acceptance condition. No speculative code before
prerequisite tasks complete. Status reflects this iteration
(`jev_auto_router_sdd_rearchitecture`).

Legend: ✅ done · 🔜 next · ⬜ pending · ◐ code/fixtures complete, live evidence pending.

## Task 0 — Inspect and preserve current staged work ✅

- Inspected the full staged diff on `codex/jev-companion` (intermediate
  "Jev advisory" architecture, 2,566 insertions).
- Superseded conclusions: Jev advisory-only; Jev deferred behind fixed
  Root + leaf; Policy as fixed-tuple selector; routing-policy.md as route
  selector.
- Preserved valuable independent work: requested-vs-observed state machine,
  economic vs hard retry caps, benchmark compass/strata, deterministic
  coexistence, review trigger refinements — all absorbed into the new SDD.
- Verification: this file + ADR 0013 record the supersession explicitly.
- Acceptance: no intermediate conclusion survives unmarked.

## Task 1 — Verify external upstreams and licenses ✅

- Files: `docs/research/jevrouter.md`, `docs/research/sol-advisor.md`,
  `docs/research/jev-upstream.md`, `docs/research/codex-runtime.md`.
- Re-verified against live sources on 2026-09-19: JevRouter (MIT, 36 commits,
  manifest contract, receipts, confidence-floor `no_decision`), sol-advisor
  (MIT, 22 commits, solo/delegate/audit/full, fail-closed installer), TypeSafe
  Jev docs (`POST /v1/systemone`, `jev-1.13.0`, $42/Btok input, output free,
  64k/32k budgets, dynamic rate limits), Codex subagent/custom-agent/MCP
  docs plus observed spawn-surface regressions
  ([codex#26363](https://github.com/openai/codex/issues/26363),
  [codex#26868](https://github.com/openai/codex/issues/26868)).
- Each doc records URL, license, architecture, failure semantics, concepts
  copied, concepts intentionally NOT copied, and evidence classes
  (OFFICIAL/OBSERVED/CLAIMED/INFERRED/UNKNOWN).
- Verification: spot-check fetches match the recorded claims.
- Acceptance: no star counts or marketing claims encoded as evidence; no
  third-party source code copied.

## Task 2 — Rewrite spec.md / plan.md / task.md and create docs/sdd ✅

- Files: `spec.md`, `plan.md`, `task.md`, `docs/sdd/*` (README,
  architecture, task-capsule, capability-catalog, jev-adapter, route-plan,
  policy-guard, delivery-lifecycle, decision-receipt, benchmark).
- spec.md is normative (roles, invariants, schemas, failure semantics,
  claims, success criteria, non-goals); plan.md is strategy; task.md is
  ordered work; docs/sdd expands subsystems; docs/research is evidence.
- Verification: §23 stale-conclusion sweep (tests) + doc cross-links resolve.
- Acceptance: handoff §25 success criteria all represented; old conclusions
  absent or explicitly historical.

## Task 3 — Add ADR 0013 and update ADR index ✅

- Files: `docs/adr/0013-jev-native-routing-architecture.md`,
  `docs/adr/README.md`.
- ADR 0013 records the reset (Jev selects, Guard validates, Codex executes,
  Root verifies) and states exactly what of ADR 0011/0012 is retained
  (per-spawn tuple mechanism; template + mechanical checks; no runtime cost
  forecasting) and what is superseded (fixed tuple table as selector;
  delegated-by-default; routing-policy.md as selector).
- Verification: ADR index statuses updated; historical ADRs not erased.
- Acceptance: supersession relationships explicit and tested.

## Task 4 — Define jev-auto-router identity migration ✅

- Files: `package.json`, `package-lock.json`, `.codex-plugin/plugin.json`,
  `.agents/plugins/marketplace.json`, `skills/jev-auto-router/**` (renamed
  from `skills/codex-auto-router`), `scripts/release.mjs`,
  `scripts/verify-release-version.mjs`, `skills/jev-auto-router/agents/*`,
  `skills/jev-auto-router/scripts/install-reviewer-agent.sh`, both READMEs,
  `CONTEXT.md`, `docs/**`, `test/*`.
- Renamed identity to `jev-auto-router` / "Jev Auto Router" /
  `https://github.com/miniLV/jev-auto-router` throughout; reviewer profile
  renamed to `jev-auto-router-astra-reviewer.toml`
  (`name = "jev_auto_router_astra_reviewer"`).
- Remote rename is a manual step recorded in `plan.md` §9 runbook; the repo
  does not assume it happened.
- Verification: identity-consistency test; release/verify scripts locate the
  new plugin name; stale-identity sweep allows only explicitly historical
  occurrences.
- Acceptance: `codex-auto-router` appears only in historical/migration
  context.

## Task 5 — Define Task Capsule ✅

- Implemented `src/capsule.ts`, canonical JSON hashing and behavioral tests.
  Validation requires trusted baseline/pre-run bindings; external summaries
  are explicit, allowlisted and separately approved. Eight behavioral checks pass.

- Files: `src/types.ts` (or `src/capsule.ts`), `docs/sdd/task-capsule.md`
  (already written), tests.
- Implement `TaskCapsule` type + validation (owned paths resolve literally,
  pairwise non-overlapping; verification commands executable; authorization
  covers side-effect class; capsule size measured).
- Verification: unit tests for every construction rule.
- Acceptance: a capsule that fails any rule is rejected before routing.

## Task 6 — Define Capability Catalog ✅

- Implemented complete host-resolved candidate enumeration, canonical digests,
  evidence freshness and deterministic exclusions; catalog behavioral tests pass.

- Files: `src/catalog.ts` (types + digest), tests.
- Implement catalog types with evidence classes, per-attempt construction,
  digest computation, `UNKNOWN`-means-absent semantics.
- Verification: digest stability test; UNKNOWN-evidence rejection test.
- Acceptance: RoutePlan validation can rely entirely on the catalog.

## Task 7 — Define normalized RouteRequest/RoutePlan ✅

- Implemented strict resolved execution/plan validation and qualification/profile
  readers. Template and per-request question digests are distinct. Schema and
  quality-first qualification tests pass; no passing production artifact exists.

- Files: `src/route-plan.ts`, tests.
- Implement schemas of spec §6, including `decision: "root"` as first-class,
  no cost fields, continuation preconditions.
- Verification: schema round-trip + invalid-plan rejection tests.
- Acceptance: nothing outside the adapter sees Jev wire formats.

## Task 8 — Implement JevAdapter ◐

- Implemented mocked single-Choice transport, response validation, cancellation,
  retry/deadline and pre-egress gates. Provider-compatible sizing remains
  UNVERIFIED: production calls fail before HTTP until approved evidence exists.

- Files: `src/jev-adapter.ts`, tests (mocked HTTP).
- Serialize RouteRequest → English JSON `state` plus **exactly one Choice
  question over complete candidate IDs** (V1 asks no other question type —
  future supervision questions are reserved for Task 27 with their own
  qualification); call `POST https://api.typesafe.ai/v1/systemone` with
  pinned `jev-1.13.0`;
  normalize the single Choice answer to a RoutePlan by exact candidate
  lookup; map failures to UNAVAILABLE/MALFORMED/LOW_CONFIDENCE/
  UNSAFE_PROJECTION/INPUT_UNSUPPORTED/CANCELLED; 64k/32k size preflight with
  a proven tokenizer (unknown sizing → INPUT_UNSUPPORTED, no HTTP); single
  retry owner (20s total deadline, ≤2 attempts) honoring `retry-after`;
  retain sanitized selection evidence.
- Verification: mocked timeout/429/malformed/low-confidence/drift/oversize
  tests; one-Choice-only schema test.
- Acceptance: adapter failure never produces a route; Jev schema appears in
  this one file only; no question type other than the single Choice exists
  in the adapter.

## Task 9 — Replace old route-selection Policy with Policy Guard ✅

- Implemented deterministic validation against current identity, scope,
  qualification and delivery evidence. Table-driven denials preserve the exact
  selected plan on ALLOW and never return an alternative.

- Files: `src/policy-guard.ts`, `test/policy.test.ts`,
  `skills/jev-auto-router/references/routing-policy.md` (already rewritten).
- Implement the 16 deterministic checks of spec §8; verdicts are exactly
  `ALLOW(plan)` / `DENY(reason)`.
- Verification: table-driven tests per check; no-alternate-route invariant.
- Acceptance: the Guard contains no selection logic; every DENY resolves to
  Root.

## Task 10 — Implement Codex capability discovery ◐

- Implemented host-snapshot discovery, freshness invalidation and cached
  catalogs. Fixtures prove listings/files are insufficient. Production host
  provenance integration remains a separate readiness gate.

- Files: `src/discovery.ts`, tests.
- Build the catalog from observed surfaces using the explicit evidence
  ladder: **DISCOVERED** (file/name/listing exists — e.g. agent TOML present,
  MCP `tools/list` entry) → **REQUESTABLE** (a trusted host surface accepts
  the capability now — loaded agent registry, native schema acceptance) →
  **ENFORCEABLE** (required sandbox/permission/scope enforcement
  independently proven) → **APPLIED** (observed on one specific execution,
  never transferred). DISCOVERED alone never enters the candidate set;
  selectability requires ≥ REQUESTABLE plus every claimed ENFORCEABLE
  property. Discovery failures omit capabilities, never fabricate them.
- Verification: fixture tests covering each ladder level and the
  TOML-exists-but-not-loaded and tools/list-is-not-permission cases.
- Acceptance: catalog digests reproducible per attempt; a TOML file or
  tools/list entry alone can never produce a selectable candidate.

## Task 11 — Implement model/effort routing (read-only probes) ◐

- Implemented branded, single-use read-only probe commands and native host
  bridge protocol. Writable and forged probes are rejected. No real confined
  native probe is claimed; host enforcement evidence remains unavailable.

- Files: `src/exec.ts` (spawn + requested-vs-observed), tests.
- P3 real runtime integration is **read-only probes only**, under the
  code-level gate `execution_mode: "probe_read_only"`: capability probe,
  execution-identity probe, model/effort observation, fresh-context
  observation (`fork_turns: none`), sandbox observation. Record the
  requested-vs-observed contract for every probe.
- **No writable child may exist in P3.** `delegated_write` is unconstructible
  until Tasks 14–16 (baseline/restore, verification, review) and the
  publication chain land in P4 — the gate is a type/state constraint, not a
  runtime check (spec §18, acceptance case A33).
- Verification: contract-state tests (match/mismatch/unobservable) on probe
  observations; a test proving `delegated_write` cannot be constructed in
  P3's module graph.
- Acceptance: UNKNOWN never recorded as MATCH; zero writable spawns.

## Task 12 — Implement agent/context routing ◐

- Implemented continuation proof validation over stopped worker identity,
  restoration, unchanged ownership/configuration and current handle evidence.
  Actual host continuation observation remains UNVERIFIED.

- Files: `src/exec.ts` extensions, tests.
- Agent/profile selection from the catalog; context mode fresh vs
  continuation; continuation only with proven handle + identity (spec §12).
- Probe for an addressable in-flight surface (`codex app-server`
  `turn/steer`/`turn/interrupt`, per `docs/research/foreman.md`) as the
  continuation-handle evidence; only its observation puts
  `continue_same_worker` in the catalog.
- Verification: continuation-proof tests; unprovable-continuation-absent
  test.
- Acceptance: unprovable continuation is not selectable.

## Task 13 — Implement requested-vs-observed execution evidence ✅

- Implemented per-dimension observations, safety violations and independent
  adoption dispositions. Attribution-only exceptions preserve UNKNOWN; unknown
  safety cannot be adopted. Contract matrix tests pass.

- Files: `src/execution-contract.ts`, tests.
- Track all dimensions of spec §9; produce state classes; enforce the
  safety-vs-attribution split.
- Verification: state-class matrix tests; weaker-scope violation triggers
  restore + stop.
- Acceptance: receipt fields for both contracts populated per execution.

## Task 14 — Implement baseline/restore ✅

- Implemented `src/baseline.ts`: authorized literal capture of dirty,
  untracked, type, mode and symlink state into an isolated workspace plus a
  backup copy; output diff classifies owned/read/out-of-scope changes and
  escaping symlinks; restore rebuilds only the isolated workspace from the
  captured backup under trusted child-stop evidence.
- Verification: six behavioral tests (capture, diff, symlink escape,
  concurrent-checkout-safe restore, recovery gate, invalid inputs).
- Acceptance: every delegated write is recoverable; the shared checkout is
  never restored to an older baseline.

## Task 15 — Implement Root mechanical verification contract ✅

- Implemented `src/verification.ts`: branded VerifiedCandidate binding the
  candidate and dependency digests; complete-diff read, scope confirmation,
  rerun of commands whose dependency fingerprint changed, reuse only when the
  full declared fingerprint is unchanged.
- Verification: affected/unaffected rerun, out-of-scope, mutation-during-test
  and self-report tests.
- Acceptance: verification result feeds review, receipts and publication.

## Task 16 — Implement fresh semantic review and isolation tiers ✅

- Implemented `src/review.ts`: fact-driven risk triggers, fixed fresh
  gpt-6-astra/medium reviewer packet with original intent independent of the
  capsule, observed isolation tiers, and a verdict bound to one exact
  candidate/dependency snapshot.
- Verification: trigger matrix, intent-omission, behavioral-tier and
  mutation-voiding tests.
- Acceptance: Tier 2 never labeled enforced; unavailable review leaves
  delivery pending.

## Task 17 — Implement correction/continuation lifecycle ✅

- Implemented `src/lifecycle.ts`: two-layer routing state, unit-scoped
  closure, an operation ledger whose host completions are consumed once,
  structured failure evidence, qualified third-correction gating,
  cancellation/cleanup state and capsule-narrowing checks.
- Verification: eleven transition tests including retry-with-evidence,
  the latch list, cancellation and continuation proof.
- Acceptance: no blind worker retries; RECONSIDER returns to Root.

## Task 18 — Implement economic + hard attempt budgets ✅

- Implemented `src/budget.ts`: monotonic Main-Task counters, the 2/3 worker
  regime with per-profile third-correction eligibility, decision/HTTP/review/
  Root-review/attribution/integration accounting and closed-unit enforcement.
- Verification: budget-exhaustion, no-refund, third-correction and closure
  tests.
- Acceptance: budget never consumed merely because it exists.

## Task 19 — Implement Decision Receipt ✅

- Implemented `src/receipt.ts`: discriminated outcomes, provider attempts
  with UNKNOWN (never zero) usage, ephemeral by default, encoding only under
  an approved sanitized benchmark policy.
- Verification: field-completeness per outcome, malformed-evidence rejection,
  persistence gate and a no-feedback-loop static test (no source module reads
  receipts).
- Acceptance: every routed attempt can produce a receipt; receipts are never
  routing input.

## Task 20 — Add Skill routing ✅

- Extended `CandidateRules` with a required `authorized_skills` grant set;
  skills enter candidates only through trusted catalog evidence plus capsule
  authorization, and the Guard revalidates the same pipeline.
- Verification: skill-selection validation tests.
- Acceptance: no bypass of catalog → Jev → Guard.

## Task 21 — Add MCP/tool/permission routing ✅

- Same extension for MCPs and tools plus least-privilege read/write/network
  grant checks; external-write and spawn effects remain unselectable.
- Verification: permission-class validation tests.
- Acceptance: unauthorized external action is unconstructible.

## Task 22 — Build independent benchmark harness ✅

- Implemented `bench/` (config, fixtures, harness, README): arms A/B/C,
  frozen strata/metrics/thresholds, diagnostic ablations, a deterministic
  offline dry-run with an injected fake Jev provider and fake worker surface
  (no keys, no network) exercising routing, Guard, lifecycle, correction and
  receipts end-to-end, plus anti-p-hacking config validation and
  quality-before-economics evaluation.
- Verification: harness dry-run on fixtures, replay stability, ablation and
  config-rejection tests; `src/` never imports `bench/`.
- Acceptance: anti-p-hacking rules enforced by harness config.

## Task 23 — Run benchmark/ablations and generate qualification artifact ◐

- Files: `docs/benchmarks/qualification.json` (created only when evidence
  exists).
- The qualification reader/schema are complete and tested; the artifact is
  deliberately absent because the deterministic dry-run cannot qualify and no
  independently checked evidence report exists yet.
- Verification: the reader rejects missing, overlapping, unbound or
  untrusted evidence; the Guard denies `PROFILE_UNQUALIFIED` without it.
- Acceptance (pending real evidence): automatic routing enabled only for
  qualified profiles.

## Task 24 — Rename package/plugin/Skill/product to jev-auto-router ✅

(Executed with Task 4 in this iteration — see its file list and acceptance.)

## Task 25 — Rewrite README/install/release/product claims ✅

- Files: `README.md`, `README.en.md`, `docs/solution.md`, `CONTEXT.md`,
  `.codex-plugin/plugin.json` descriptions/default prompt.
- Honest claims only (spec §16): architecture description + aims; savings
  explicitly benchmark-dependent; Jev positioned as the routing brain; old
  identity mentioned only as rename history.
- Verification: forbidden-claims sweep in tests.
- Acceptance: no pre-evidence savings language.

## Task 26 — Full tests, typecheck, diff check, release consistency review ✅

- Run: `npm test`, `npm run typecheck`, `git diff --check`.
- Sweep for stale identity and stale architecture terms (spec §23/§26):
  `codex-auto-router`, `Codex Auto Router`, "Jev advisory", "Jev experiment",
  "delegated by default", "Everything else eligible goes to Terra" — every
  remaining occurrence must be intentionally historical, migration-related, or
  explicitly justified.
- This iteration's gates are green (132/132 tests, typecheck, diff check,
  sweeps enforced by `test/policy.test.ts`); the task remains the recurring
  final gate for P1–P6 iterations, and final acceptance belongs to the
  independent review layer.
- Acceptance: all gates green; sweeps clean; the complete diff reviewed
  against handoff §25 before handoff to the independent review layer.

## Task 27 — In-flight supervision slice (FUTURE, post-P6, qualification-gated) ⬜

- Not in V1. Candidate design recorded in `docs/research/foreman.md`
  ("Combining the designs"); promotion requires a spec amendment and its own
  benchmark qualification (false-positive takeover is the admitted upstream
  risk).
- Preconditions: observable execution channel in the catalog (`OBSERVED`
  evidence); bounded config-typed observations; one parallel Jev Noul batch
  per debounced window estimating `worker_stuck` / `work_off_track` /
  `meaningful_progress`; deterministic policy with frozen thresholds,
  anti-flap grace, outcomes exactly `CONTINUE | STEER | TAKEOVER`.
- STEER = `continue_same_worker` over a proven handle (Root authors the
  guidance; steer cap 1; a steered execution is still one execution).
  TAKEOVER latches routing closed (acceptance case A10).
- Invariants: supervision output is lifecycle input only — never routing
  input, never lowers review (may raise); assessments count as route
  overhead in receipts; ships OFF by default.
