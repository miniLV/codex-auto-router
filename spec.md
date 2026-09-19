# Jev Auto Router — Specification

Normative product and system requirements for `jev-auto-router` (display name
**Jev Auto Router**). This file defines WHAT the system must be. The canonical
runtime Module is
[skills/jev-auto-router/references/routing-policy.md](skills/jev-auto-router/references/routing-policy.md);
[plan.md](plan.md) defines HOW it is built; [task.md](task.md) defines the
ordered work; [docs/sdd/](docs/sdd/README.md) expands subsystem design;
[docs/research/](docs/research/) records external evidence and is never
normative.

## 1. Purpose

Jev Auto Router is a Jev-native, Codex-specific capability and model routing
and delivery system. It keeps the frontier Root in control of requirements and
final acceptance, uses Jev as the sole automatic route-selection intelligence,
validates every route through a deterministic Policy Guard, executes through
Codex-native primitives, and independently verifies and reviews the result
before acceptance.

The goal is **not** to maximize delegation. The goal is:

> Move appropriate execution away from the frontier Root — without degrading
> delivery quality — while Root retains requirements, verification, and final
> acceptance, and while end-to-end economics remain benchmark-qualified before
> any savings claim.

Core product identity:

1. **Jev-native routing** — Jev is the routing brain; a strategic core
   dependency, not an optional advisor.
2. **Trustworthy delivery** — bounded Task Capsules, truthful capability
   catalogs, requested-vs-observed execution evidence, recoverable writes,
   Root mechanical verification, fresh independent review.
3. **Deterministic governance** — a Policy Guard with unconditional veto and
   zero route-selection authority.

## 2. Roles and authority

| Role | Owns | Never does |
| --- | --- | --- |
| **Frontier Root** | Requirements, ambiguity resolution, architecture, decomposition, Task Capsule authoring, success criteria, user interaction, final verification judgment, final acceptance, external irreversible actions | Select routes; hold shape heuristics ("single-file → cheap lane") |
| **Jev** | The ONLY automatic route selection: root vs delegate, model, reasoning effort, agent, Skill set, MCP set, tool scope, context strategy, continuation strategy | Write code, specs, or prose; verify artifacts; execute |
| **JevAdapter** | The single seam to the Jev API: request serialization, response normalization, timeout/error mapping | Select routes; validate policy; add providers |
| **Policy Guard** | Deterministic validation of the RoutePlan; unconditional veto | Choose or substitute routes; downgrade silently; apply legacy heuristics |
| **Codex native runtime** | Execution of the accepted RoutePlan: spawn, model/effort override, Skills, MCPs, tools, sandbox, continuation surfaces | Decide anything |

Canonical control flow:

```text
User → Frontier Root → requirements/architecture/decomposition
  → Task Capsule
  → Runtime Capability Catalog
  → RouteRequest → JevAdapter → Jev → RoutePlan
  → Policy Guard (ALLOW | DENY)
  → Codex native execution
  → Worker result
  → Root mechanical verification
  → Fresh independent review when triggered
  → Root final acceptance → deliver
```

## 3. Route decision

A Route Decision is exactly one of:

- `ROOT_DIRECT` — Root executes the unit itself, with the same verification
  discipline. This is a first-class outcome and the terminal state of every
  failure path; it is not a failure.
- **Delegate** — one child executes an accepted RoutePlan.

There are no fixed lanes, no fixed tuple table, and no shape heuristics.
`ROOT_DIRECT` may be chosen by Jev (a valid RoutePlan), forced by the Guard's
`DENY`, or reached by any failure semantics below.

## 4. Task Capsule (normative requirements)

Before any routing, Root MUST convert a decomposed implementation unit into a
bounded Task Capsule containing at least: `task_unit_id`, `objective`,
`rationale`, exact owned paths/resource scope, interfaces that must remain
compatible, constraints, user authorization boundary, success criteria,
verification commands/evidence, baseline information, known risk flags,
allowed side-effect class, and relevant context references.

Requirements:

1. Root authors the capsule; Jev and workers never write or broaden it.
2. The capsule MUST NOT copy the entire Root conversation by default; the
   capsule is an economic boundary and its size is measured and counted in
   the Decision Receipt.
3. The five-section dispatch template (OBJECTIVE, FILES AND OWNERSHIP,
   INTERFACES, CONSTRAINTS, VERIFICATION + structured RETURN) is the
   worker-facing projection of the capsule.
4. During correction, ownership, authorization, and success criteria may only
   narrow; broadening requires new user authorization.

See [docs/sdd/task-capsule.md](docs/sdd/task-capsule.md).

## 5. Runtime Capability Catalog (normative requirements)

Before Jev selects a route, the system MUST construct a truthful catalog of
what the runtime actually provides now: models (id, supported reasoning
efforts, observed availability, spawn support), agents (profile id, model
constraints, sandbox, permissions, continuation capability), skills, MCPs
(with read/write/external-action class), tools (permission class), and
context modes (fresh, continuation, fork options actually supported).

Requirements:

1. Jev MUST select only capabilities present in the catalog. A RoutePlan
   referencing an absent or invented capability is invalid; the Guard denies
   it.
2. Catalog entries MUST carry evidence classes (`OBSERVED`, `UNKNOWN`).
   `UNKNOWN` evidence means the capability is absent for selection purposes.
3. The catalog MUST NOT contain quota, account, ccusage, credit, model-mix,
   latency, or dashboard data — those are observers, never routing inputs.
4. The catalog is rebuilt (or freshness-validated) per routing decision and
   its digest is recorded in the Decision Receipt.

See [docs/sdd/capability-catalog.md](docs/sdd/capability-catalog.md).

## 6. RouteRequest / RoutePlan (normative schemas)

```text
RouteRequest:
  task_capsule
  capability_catalog (+ digest)
  attempt_state            { attempt_index, execution_index, economic_cap, hard_cap }
  previous_failure_evidence?
  benchmark_qualification_context

RoutePlan:
  decision                 "root" | "delegate"
  model                    (must exist in catalog)
  reasoning_effort         (must be supported by the model entry)
  agent?                   (profile id from catalog)
  skills[]                 (catalog ids)
  mcps[]                   (catalog ids)
  tools[]                  (catalog ids)
  context_mode             "fresh" | "continuation"
  continuation_target?     (only when runtime identity/handle are provable)
  confidence               (from Jev)
  risk                     (class)
  benefit_class            (class — never an invented token/dollar forecast)
  reason_codes[]
```

Rules:

1. `decision: "root"` is a valid, first-class plan.
2. No exact token or cost forecasts. Calibrated probabilities and classes only.
3. Every capability field must resolve to a catalog entry.
4. Continuation is selectable only when a continuation handle, worker identity,
   unchanged ownership, and re-confirmable runtime contract are observable.

See [docs/sdd/route-plan.md](docs/sdd/route-plan.md).

## 7. JevAdapter (normative requirements)

1. Jev's wire/API schema appears in exactly one adapter boundary
   (`RouteRequest → JevAdapter → Jev API → normalized RoutePlan`).
2. The adapter maps provider failures to explicit states — `UNAVAILABLE`
   (timeout, network, 429/529/5xx), `MALFORMED` (schema-invalid, unexpected
   model id), `LOW_CONFIDENCE` (below the Guard's frozen floor) — and never
   invents a route.
3. Every adapter failure state means automatic delegation is unavailable and
   resolves to Root execution. There is no fallback selector.
4. The adapter pins an explicit Jev model id and validates alias drift.
5. No speculative providers (HeuristicRouter, OpenAIRouter, RuleRouter,
   GenericRouterPlugin). Jev is the only provider.

See [docs/sdd/jev-adapter.md](docs/sdd/jev-adapter.md) and
[docs/research/jev-upstream.md](docs/research/jev-upstream.md).

## 8. Policy Guard (normative requirements)

The Guard validates, with unconditional veto and no alternate-routing
authority. On rejection it returns `DENY(reason) → Root executes`. It never
selects, substitutes, or downgrades.

The Guard checks at least: schema validity; confidence floor; capability
existence and model/effort support; context-mode support; bounded task
ownership; user authorization coverage; concrete verification; recoverable
baseline for writable targets; least-privilege permissions; no unauthorized
external side effects; no forbidden child delegation/fan-out; benchmark
profile qualification; attempt budget; review budget; provable continuation
target.

Guard thresholds (confidence floor, qualification semantics) are frozen per
benchmark release and never tuned per task at runtime. The Guard never reads
dashboard, ccusage, credit, quota, model-mix, or latency data.

See [docs/sdd/policy-guard.md](docs/sdd/policy-guard.md).

## 9. Execution contract (normative requirements)

The system MUST track requested versus observed for: model, reasoning effort,
agent/profile, context mode, sandbox, permissions, Skills, MCPs, tool scopes,
continuation identity. Required state classes at minimum:

```text
requested_match
requested_mismatch
routing_metadata_unobservable
accepted_under_unobservable
permission_scope_violation
context_boundary_violation
```

Rules:

1. **UNKNOWN is never MATCH.**
2. Artifact correctness and route/cost attribution correctness are separate. A
   more expensive unexpected model may produce a valid artifact but invalid
   savings evidence; a mismatch observed at adoption excludes the run from
   verified-savings evidence.
3. A weaker/unauthorized permission or execution-scope violation is a stronger
   safety failure: reject, restore, and stop automatic delegation for the
   task.
4. Unobservable metadata alone does not discard independently verified output;
   it is recorded as residual risk and never counted as verified savings.

## 10. Recoverable delivery (invariants)

1. Delegated writes are recoverable: baseline captured for every owned
   writable path before dispatch; restore is the primary recovery.
2. Worker self-report never equals acceptance. Root performs its own
   mechanical verification: read the complete diff, confirm scope, rerun the
   verification commands the owned paths could affect.
3. Do not invisibly repair a rejected worker patch to avoid counting a failed
   attempt.
4. Root takeover after restore stays within the original authorization unless
   requirements, scope, or architecture materially change.

## 11. Fresh independent semantic review (normative requirements)

1. Mechanical verification and semantic review are distinct
   responsibilities. Review is risk-triggered (public interface, data
   structure, permission/security path, non-empty `JUDGMENT CALLS` or `GAPS`,
   and similar signals), at most one per candidate, bounded per Main Task by
   the execution budget.
2. The reviewer is fresh-context, independent of the worker, has no
   descendants, never implements fixes, judges both the diff and whether the
   specification itself was adequate, and returns exactly `ACCEPT`, `REVISE`,
   or `RECONSIDER`.
3. Isolation strength is described from observed evidence only:
   `ENFORCED_READ_ONLY` (observed runtime policy proves read-only),
   `BEHAVIORALLY_READ_ONLY` (hard isolation unavailable and not required;
   before/after state proves no mutation), `REVIEW_UNAVAILABLE` (cannot be
   demonstrated, or reviewer mutated state). Tier 2 is never labeled enforced.
4. Any mutation after a semantic verdict voids the verdict; a corrected
   candidate is a new candidate.
5. `RECONSIDER` returns the task to Root architecture/judgment; workers are
   never blindly retried.

## 12. Correction, continuation, and attempt economics

1. After a failed candidate, Root produces structured failure evidence; Jev
   receives the original capsule, the failure evidence, remaining
   capabilities, and attempt state, and may choose: Root takeover,
   `continue_same_worker`, `fresh_worker`, or a different
   model/agent/capability.
2. Same-worker continuation is permitted ONLY when runtime evidence proves a
   continuation handle, worker identity, unchanged ownership, and a
   re-confirmable model/runtime contract. Otherwise continuation is absent
   from the catalog and unavailable to Jev.
3. Attempt economics: hard worker execution ceiling = **3** per Main Task;
   normal automatic economic ceiling = **2**. A third execution requires
   explicit benchmark qualification for that task profile; otherwise Root
   takes over.
4. Immediate takeover conditions: repeated same verification failure;
   repeated semantic finding; scope thrash; permission violation; execution
   identity uncertainty; second automatic execution failure; remaining
   expected benefit no longer positive or materially uncertain. The safety
   budget is not consumed merely because it exists.
5. One active delegated child at a time; reviewer and worker never run
   concurrently; no child may delegate.

## 13. Decision Receipt (normative requirements)

Every routed attempt MUST be able to produce a structured Decision Receipt
containing: task unit identity/digest, catalog digest, Jev request digest,
normalized RoutePlan, confidence, risk, benefit class, reason codes, Guard
verdict (+ rejection reason), requested and observed execution contracts,
attempt index, continuation mode, verification result, review tier and
verdict, restore/takeover, final outcome, and usage fields (tokens by role,
cached/uncached input, reasoning usage, latency).

Rules:

1. Receipts are evidence, never routing authority. Nothing reads a receipt to
   decide a future route.
2. Normal routing state is ephemeral; benchmark/research mode may persist
   sanitized receipts.
3. Runs with `routing_metadata_unobservable` or any mismatch state are flagged
   and excluded from verified-savings evidence.

See [docs/sdd/decision-receipt.md](docs/sdd/decision-receipt.md).

## 14. Failure semantics

Every failure path resolves to **Root execution** — degraded, never broken:

| Trigger | Resolution |
| --- | --- |
| Jev timeout / unavailable / malformed / low-confidence | Automatic delegation unavailable → Root executes |
| Guard `DENY` | Root executes (never an alternate route) |
| Execution contract violation | Restore when necessary → Root takeover |
| Worker failure | Restore → correction only if budgets and benefit permit → else Root takeover |
| Reviewer `RECONSIDER` | Return to Root architecture/judgment (never blind worker retry) |
| Reviewer mutation / tier-3 review | Verdict voided; lane stopped |
| Missing/incomplete/ambiguous lifecycle state | Delegation ends; continue in Root |
| Competing routing authority governs the task | Stand down to `ROOT_DIRECT` |

## 15. Benchmark contract (normative requirements)

1. The benchmark measures the whole delivery cycle (routing + capsule +
   execution + verification + review + retries + restores), not model-share
   migration.
2. Arms: A = pure frontier Root; B = same-session/JevRouter-style routing when
   reproducibly available (recorded unavailable otherwise); C = Jev Auto
   Router. Optional ablations: C-minus-review, C-minus-continuation, C
   model-only, C full-capability.
3. Quality first: completion rate, blinded acceptance, critical regressions,
   security/interface defects, human intervention, restore rate, retry rate.
   **Quality non-inferiority passes before any economics is evaluated.**
4. Economics (only after quality passes): total tokens, flagship tokens,
   cached/uncached input, output tokens, reasoning tokens, route overhead,
   capsule overhead, review overhead, retry overhead, P50/P95 cost proxy,
   P50/P95 latency.
5. Subscription quota percentage is not automatically convertible to per-task
   model cost. Unknown routing attribution never counts as verified savings.
6. Anti-p-hacking: freeze corpus, strata, metrics, thresholds, exclusion
   rules; failures/timeouts count; publish losing strata; no mid-run tuning.
7. Automatic routing for a task profile requires a qualification artifact
   (frozen evidence); profiles without evidence are denied automatic routing.

See [docs/sdd/benchmark.md](docs/sdd/benchmark.md).

## 16. Product claims

Allowed before benchmark qualification:

> Jev Auto Router is a Jev-native, recoverable routing and delivery
> architecture for Codex. It aims to move appropriate execution away from the
> frontier Root while Root retains requirements, verification, and final
> acceptance. End-to-end economic savings remain benchmark-dependent.

Forbidden before evidence: "automatically saves tokens", "always saves
quota", "cheaper by design", "Jev guarantees the optimal model", "more
cheap-model tokens prove savings", "routing lowers cost automatically".

## 17. Identity

Canonical identity: `jev-auto-router`. Display name: **Jev Auto Router**.
Target repository: <https://github.com/miniLV/jev-auto-router>. The identity
must be consistent across package metadata, plugin and marketplace manifests,
Skill directory and frontmatter, reviewer profile names, documentation,
release tooling, and tests. The old `codex-auto-router` identity is
historical only (see [plan.md](plan.md) §9 for the rename runbook). Release
and install validation MUST detect inconsistent old/new identity.

## 18. Success criteria

The architecture is acceptable only when all are true:

1. Jev is the sole automatic route selector.
2. The Policy Guard has veto but no route-selection algorithm.
3. Root retains requirements, architecture, verification, and acceptance.
4. Current runtime capabilities constrain what Jev may select.
5. Jev integration is isolated behind one thin adapter.
6. Jev failure degrades to Root rather than failing the user's task.
7. Route selection may cover model / reasoning effort / agent / Skill / MCP /
   tool scope, expanded progressively.
8. Requested vs observed execution is explicitly represented; UNKNOWN is
   never MATCH.
9. Delegated writes are restorable.
10. Worker self-report never equals acceptance.
11. Mechanical verification and semantic review are distinct.
12. Isolation strength is described from observed evidence only.
13. Continuation is used only when runtime identity/handle is proven.
14. Economic retries end before the hard safety budget when appropriate.
15. Benchmark tests quality non-inferiority before savings.
16. Product claims match available evidence.
17. Canonical identity is `jev-auto-router` everywhere.
18. No contradictory old Jev-advisory architecture remains.

## 19. Non-goals

- No LLM-independent heuristic model router.
- No generic multi-provider routing framework; Jev is the only provider.
- No second route selector in the Policy Guard.
- No current-account quota fed into routing.
- No worker self-report as verification.
- No UNKNOWN classified as MATCH.
- No silent capability substitution.
- No economic savings claims before qualification.
- No third-party code reproduced without license discipline.
- No over-engineered provider abstraction before the first Jev
  implementation works.

## 20. Validation

`npm test`, `npm run typecheck`, and `git diff --check` validate the static
contract. Static validation proves shape and wording only, never runtime
enforcement; runtime proof comes from real platform invocations observed by
Root. Stale-identity and stale-architecture sweeps are part of the test
suite.
