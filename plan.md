# Jev Auto Router — Implementation Plan

Architecture implementation strategy for the architecture defined in
[spec.md](spec.md). Ordered work with per-task detail lives in
[task.md](task.md); subsystem design in [docs/sdd/](docs/sdd/README.md).

## 1. Strategy and sequencing principles

```text
P0 — preserve state, verify upstreams, rename design, freeze SDD
P1 — core schemas (Task Capsule, Capability Catalog, RouteRequest/RoutePlan,
     Decision Receipt)
P2 — Jev routing core (JevAdapter, failure semantics, normalization)
P3 — Policy Guard + model/agent/context execution with requested-vs-observed
P4 — trustworthy delivery (baseline/restore, verification, review, isolation
     tiers, bounded continuation)
P5 — capability expansion (Skills, MCPs, tools, permissions)
P6 — benchmark (arms, ablations, qualification artifact)
P7 — productization (rename rollout, install flow, release, claims)
```

Principles:

1. **Jev is not deferred.** The intermediate "prove fixed Root + leaf first,
   then maybe add Jev" sequencing is superseded (ADR 0013). Jev routing (P2)
   lands before any economics are even measurable, because without a selector
   there is nothing to benchmark.
2. **The static contract ships first, runtime code follows.** The repository's
   current strength is a test-enforced static contract. Each phase updates
   contract + tests and adds the runtime artifact behind them; no speculative
   code before its prerequisite task completes.
3. **Quality invariants land before economics.** Baseline/restore and
   mechanical verification (P4 foundations, already contractually present)
   must never be weakened by routing features.
4. **Benchmark before claims.** No savings language anywhere until the P6
   qualification artifact exists.

## 2. Migration from the current repository

The current `codex-auto-router` ships a static contract: a Skill
(`SKILL.md` + `references/routing-policy.md`), an observer Dashboard
(`src/`, `ccusage`), release/install tooling, and static tests.

What is kept, transformed, or removed:

| Current artifact | Disposition |
| --- | --- |
| `references/routing-policy.md` as fixed-tuple selector (LUNA/TERRA table, Luna shape heuristics) | **Removed as selector.** Rewritten as the canonical runtime Module of the new architecture: Task Capsule gate, catalog, Jev routing, Policy Guard, lifecycle, budgets |
| Five-section dispatch template + three mechanical checks | **Kept** as the worker-facing projection of the Task Capsule (ADR 0012 retained) |
| Per-spawn tuple mechanism (ADR 0011) | **Kept** as the mechanism; tuple values now come from the RoutePlan + Capability Catalog |
| Baseline/restore, Root mechanical verification, risk-triggered review, isolation-observed discipline | **Kept and strengthened** (Sol-Advisor trust model, ADRs 0001–0010 history) |
| Reviewer profile + fail-closed installer | **Kept**, renamed with the product identity |
| Dashboard / `ccusage` / credit estimates | **Kept as observers**, never routing inputs; terminology updated |
| Five-dispatch budget | **Replaced** by execution-budget economics: hard ceiling 3, automatic economic ceiling 2 |
| "Delegated by default" classification | **Removed**; Jev decides, Guard validates |
| Intermediate "Jev advisory" companion documents (staged on `codex/jev-companion`) | **Superseded** by ADR 0013; valuable independent work (requested-vs-observed states, economic caps, benchmark compass) absorbed into the new SDD |

## 3. P0 — preserve state + research + rename design (this iteration)

Done in this iteration:

- Full staged diff inspected; intermediate "Jev advisory" conclusions
  identified and superseded rather than blindly continued.
- Upstreams verified and recorded with evidence classes:
  [JevRouter](docs/research/jevrouter.md),
  [sol-advisor](docs/research/sol-advisor.md),
  [TypeSafe Jev](docs/research/jev-upstream.md),
  [Codex runtime](docs/research/codex-runtime.md).
- SDD frozen: `spec.md`, `plan.md`, `task.md`, `docs/sdd/*`, ADR 0013.
- Identity migration designed and executed in-repo (§9).

## 4. P1 — Core schemas

Define the repository-owned types that everything else compiles against:
`TaskCapsule`, `CapabilityCatalog` (+ digest), `RouteRequest`, `RoutePlan`,
`ExecutionContract` (requested/observed state classes), `DecisionReceipt`,
`RoutingFailure`. Pure types + validation functions; no provider calls, no
execution. Tests validate schema invariants (UNKNOWN never MATCH; no cost
fields; catalog-evidence classes).

## 5. P2 — Jev routing core

Implement the single JevAdapter: serialize RouteRequest → Jev `state` +
typed questions (Choice/Score/Noul), call `POST /v1/systemone`, normalize the
response into a RoutePlan, map failures to `UNAVAILABLE` / `MALFORMED` /
`LOW_CONFIDENCE`, pin an explicit Jev model id, honor retry/backoff with
bounded attempts, retain the raw response for the receipt. No fallback
selector exists anywhere in this phase — failure is Root execution.

## 6. P3 — Policy Guard + model/agent execution

Implement the Guard as the deterministic validator over the RoutePlan
(spec §8 checks). Implement Codex capability discovery that builds the
truthful catalog from observed surfaces (spawn surface parameters, agent
TOMLs, MCP `tools/list`, sandbox policy types). Execute accepted plans via
native spawn with per-spawn model/effort/agent/context; record the
requested-vs-observed contract per execution.

## 7. P4 — Trustworthy delivery

Baseline capture/restore for owned writable paths; Root mechanical
verification contract; risk-triggered fresh review with observed isolation
tiers; final state confirmation; structured failure evidence; bounded
correction/continuation (same-worker only with proven handle/identity);
attempt economics (hard 3 / economic 2, third requires qualification).

## 8. P5 — Capability expansion

Add Skills, then MCPs/tools/permissions, to the catalog and RoutePlan —
always through the same path: catalog → Jev → normalized RoutePlan → Guard.
Never bolt a capability class onto execution without routing it through the
same pipeline.

## 9. P6 → P7 sequencing and the rename runbook

Benchmark (P6) precedes productization claims (P7). The identity rename has
two halves:

**In-repository (done in this iteration):** canonical name `jev-auto-router`
across `package.json`, `package-lock.json`, `.codex-plugin/plugin.json`,
`.agents/plugins/marketplace.json`, the Skill directory and frontmatter, the
reviewer profile and installer, release/verify scripts, tests, READMEs,
CONTEXT.md, and docs. Old identity appears only as explicitly historical or
migration-related text, enforced by tests.

**Repository/remote (manual, before the next release):**

1. Rename the GitHub repository `miniLV/codex-auto-router` →
   `miniLV/jev-auto-router` (Settings → General → rename). GitHub redirects
   the old URL until a new repository takes the old name — do not squat it.
2. Update the local remote: `git remote set-url origin
   https://github.com/miniLV/jev-auto-router.git`.
3. Release `v0.2.0` (first version of the new architecture) via
   `npm run release -- 0.2.0 && git push origin master v0.2.0`; the release
   gate verifies package/plugin/lockfile/marketplace alignment.
4. Marketplace and install examples point at the new URL and the release tag
   (already encoded in-repo); update the Plugins Directory submission if the
   old listing exists.
5. Because the project is 0.x, no compatibility alias subsystem is built.
   If an install alias ever becomes demonstrably necessary, document it
   explicitly rather than allowing accidental dual identity.

**Validation:** release/install tests fail on old/new identity mismatch
(anywhere `codex-auto-router` appears outside allowlisted historical
locations).

## 10. Rollout

- The Skill remains a static contract interpreted by Root until P2/P3 code
  exists; `ROOT_DIRECT` is always a fully functional path, so every phase is
  shippable.
- Dashboard continues to ship as an observer; its copy is updated to the new
  identity and honest claim language.
- Each phase ends with `npm test`, `npm run typecheck`,
  `git diff --check`, and the stale-term sweep.

## 11. Coding constraints

While implementing any phase:

- no executable online cost predictor;
- no dashboard/quota/account state fed into routing;
- no concurrent worker fan-out;
- no weakening of baseline restore;
- no child self-report as verification;
- no silent model/capability substitution;
- no UNKNOWN routing metadata classified as MATCH;
- no savings claims before the qualification artifact exists;
- route selection code lives nowhere in this repository — the selector is
  Jev, reached only through the adapter.
