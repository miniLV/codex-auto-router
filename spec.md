# Jev Auto Router — Specification

Normative product requirements for **Jev Auto Router**. The [Runtime Router
Policy](skills/jev-auto-router/references/routing-policy.md) is the sole
operational Module interpreted by Root. This specification owns invariants;
[SDD](docs/sdd/README.md) owns the detailed Interfaces referenced below.
Neither may relax the other. A conflict closes automatic routing; an agent
must not choose the more permissive wording. Research and product copy do not
define runtime behavior. [ADR 0014](docs/adr/0014-quality-constrained-jev-delivery.md)
completes ADR 0013 without changing Jev's central authority.

## 1. Objective

**Preserve delivery quality; then reduce quality-constrained delivery
economics — frozen-price-weighted delivery cost and frontier-capacity
consumption.** Jev is the sole automatic selector of the execution route and
model configuration.

- **Hard constraint:** delivery quality must be non-inferior to pure frontier
  Root on every qualified profile. Critical regressions never buy economics.
- **Primary economic objectives** (evaluated only after quality passes):
  paired reduction in (a) weighted delivery cost and (b) frontier-capacity
  consumption (flagship input and reasoning tokens attributable to the Main
  Task). Either may qualify a profile; both are always reported.
- **Secondary:** total raw tokens, latency, retry/restore rates, model share.
  Raw cross-model token totals are **not** the primary objective: replacing
  expensive frontier tokens with a larger number of cheap-model tokens can be
  the intended outcome, not a failure.

Price weights are frozen per benchmark release and used only by the
benchmark; runtime routing and the Guard never see prices, predict cost, or
optimize token counts. Count capsule construction, discovery, routing,
execution, verification, review, retries, integration and Root takeover in
every arm. No globally optimal route is claimed before evidence exists.

Avoid duplicated Root implementation, full-conversation handoffs, repeated
semantic sampling, unnecessary reviews and unchanged-context reads. Never
remove acceptance criteria, safety checks or required review to save tokens.
Production delegation requires qualified whole-policy evidence.

## 2. Authority

| Role | Owns | Forbidden |
| --- | --- | --- |
| Frontier Root | User intent, architecture, decomposition, capsule, mechanical verification, external actions and final acceptance | Choosing workers/models by intuition, repairing a rejected worker invisibly |
| Jev | Sole automatic choice among complete root/delegate configurations, including model, effort, agent, context and admitted capabilities | Execution, generating specifications, granting authorization |
| JevAdapter | One provider-specific serialization/HTTP/normalization Seam | Completing or substituting routes, inventing confidence thresholds |
| Policy Guard | Deterministic ALLOW(plan) or DENY(reason) | Ranking candidates or selecting alternatives |
| Codex native runtime | Applying requested configuration and exposing evidence | Route selection or artifact acceptance |

Catalog construction enumerates possibilities and excludes only explicitly
ineligible combinations. Lifecycle owns fixed fallback, counters and
publication. These are deterministic responsibilities, not decision layers.
Fallback to the existing Root and the fixed independent governance reviewer
are explicit exceptions to worker selection; neither may switch Root or
select an economic replacement worker.

## 3. Routing state and closure

A Jev RoutePlan is root or delegate. Lifecycle fallback is a separate outcome,
never a fabricated Jev plan. Root's model is unchanged. One Choice selects
one complete configuration. Only Jev can select a new model, fresh worker or
continuation after a recoverable failure.

Routing state has two explicit layers. **MainTaskRoutingState** is `OPEN` or
`CLOSED`. **TaskUnitRoutingState** is `OPEN | ROOT_DIRECT | DELEGATED |
ACCEPTED | CLOSED`. All counters belong to the Main Task and never reset.

**Unit-level events close the current unit's automatic routing only:** a Jev
root choice, Guard DENY, provider failure, low confidence, unsafe or oversize
projection, unsupported candidates, attribution closure, unit cancellation,
or unit acceptance. The unit proceeds in Root; other units of an OPEN Main
Task may still route within remaining budgets.

**The Main Task latch closes all remaining units, only for:** a safety or
permission-scope violation; unknown or lost lifecycle state, counter
corruption or identity ambiguity; competing routing authority; authorization
ambiguity; exhaustion of the global worker-execution budget; or invalidated
host trust. There is no semantic retry of a denied proposal or relabeling to
reset counters. Whole-task cancellation closes everything without automatic
Root takeover. Fallback restores responsibility, not authorization for a
denied action or a guarantee that every task can be completed.

## 4. Task Capsule and external data

Root keeps a local RootIntent containing original user instructions and stable
acceptance IDs, then authors a local TaskCapsule. Its five-section worker
projection retains exact ownership, compatible Interfaces, constraints and
pre-run verification. A capsule is not the Root conversation.

Only a separate allowlisted RoutingProjection may leave the host. An approved
data policy must cover provider, content categories and purpose before egress.
Credentials, raw logs, environment values, full conversations, raw baselines
and unrestricted file contents never enter provider state. Secret scanning is
defense in depth, not proof that arbitrary text is safe to upload. Untrusted
material is labeled data; it cannot change instructions, authorization,
candidate construction or qualification. Unsafe or materially incomplete
projections close routing before HTTP.

During correction ownership may narrow, but the capsule's acceptance criteria
cannot be removed or weakened. Root retains the entire Main Task acceptance
set across decomposed units. New scope requires authorization; ordinary
in-scope correction does not require repeated permission.

The projection seam must not become a hidden selector. `task_traits` are
**deterministic fields derived only from observable facts** (owned-file count
bucket, changed language, side-effect class, public-interface touched,
verification count, context-size bucket, persistent change, risk flags).
Semantic summaries are free English **except** they must never contain
route-directed language — difficulty judgments, recommended models or lanes,
cheap/expensive, simple/complex, delegate/root suggestions, or
strong/weak-model characterizations. Root describes; only Jev chooses. Exact
fields and the banned vocabulary:
[Task Capsule](docs/sdd/task-capsule.md).

## 5. Capability truth

Capability evidence has an explicit ladder: **DISCOVERED** (a file, name or
listing exists), **REQUESTABLE** (a trusted host surface accepts the
capability now), **ENFORCEABLE** (required sandbox/permission/scope
enforcement is independently proven), **APPLIED** (observed on a specific
execution). Catalog selectability requires at least REQUESTABLE plus the
ENFORCEABLE properties the candidate claims; application is always a separate
per-execution observation. UNKNOWN selectability means absent. Installed
files, model names and tool descriptions alone prove nothing beyond
DISCOVERED; MCP `tools/list` proves discovery, not permission or effect
classification. Cache trusted discovery within the session by semantic
host/configuration fingerprint; freshness-validate before each decision and
spawn. Do not run paid probes for every model/effort combination.

Resolve inherited capabilities explicitly. Offer every compatible,
authorized, qualified candidate without top-K, price sorting or shape-to-model
rules. Quota, account, ccusage, credit, model-mix, historical latency and
Dashboard data are never routing inputs. See
[Capability Catalog](docs/sdd/capability-catalog.md).

## 6. Repository-owned schemas

[RouteRequest / RoutePlan](docs/sdd/route-plan.md) defines local intent/capsule
references, safe projections, complete candidate snapshots, request identity,
frozen qualification context, AttemptState, bounded FailureEvidence,
RootPlan/DelegatePlan, local GuardContext and RoutingFailure.

Root plans have no child configuration. Delegate plans contain every required
effective capability; arrays are required and empty means none, never inherit.
The adapter looks up the exact chosen candidate; it cannot fill missing
effort, profile, tools or context. No precise runtime token/dollar forecasts.
Frozen empirical token evidence is not a runtime forecast.

## 7. JevAdapter

V1 sends exactly one Choice over complete candidate IDs, including root, to
pinned jev-1.13.0. No Score, Noul, generated explanation, recursive planner,
semantic resampling or alternate provider. Risk is a policy/capsule annotation;
benefit is qualified evidence; reason codes describe recorded facts, never an
invented Jev explanation.

Guard owns the frozen confidence floor. Adapter receives that exact policy
value and may classify a valid low-confidence answer without a second floor.
Confidence is a provider distribution statistic, not a correctness guarantee.
Both production and research require frozen floors; no production floor or
qualification entry is invented before evaluation.

Maximum 255 options, 64,000 total provider input tokens and 32,000 tokens for
state plus the longest question. With one question the 32,000 limit dominates.
Require a pinned provider-compatible tokenizer or validated conservative upper
bound; UNKNOWN sizing means Root. Bytes are not tokens. Never silently truncate
candidates or safety-relevant context.

One retry owner: 20-second total deadline, at most two HTTP attempts, at most
10 seconds per attempt including body read. Respect Retry-After and remaining
time. Malformed, low-confidence, drift and non-retryable 4xx are terminal.
Cancellation disarms pending responses; every response checks the pinned
model. See [JevAdapter](docs/sdd/jev-adapter.md).

## 8. Policy Guard

Guard returns only ALLOW(RoutePlan) or DENY(reason). Lifecycle maps DENY to
closed routing and Root responsibility. Guard never modifies a plan or picks
the next-best candidate. Preflight can reject ineligible work before paying
for Jev, without choosing another delegate.

The [16 checks](docs/sdd/policy-guard.md) cover schema/identity, confidence,
fresh capabilities, complete configuration compatibility, context, ownership,
authorization/egress, verification, isolated baseline, effective least privilege,
external effects, descendants, qualification/research permission, execution
budget, review capacity and continuation proof. Thresholds are frozen, never
tuned per task.

## 9. Execution evidence

Keep these separate:

~~~text
observation: requested_match | requested_mismatch | routing_metadata_unobservable
violation: none | permission_scope_violation | context_boundary_violation
disposition: not_adopted | accepted | accepted_under_unobservable | accepted_with_mismatch
~~~

**UNKNOWN is never MATCH.** Independently enforced workspace, data, tool,
permission and context restrictions must be proven before the first child
instruction. Unknown safety cannot be rescued by a correct patch.

Missing model/effort attribution alone may permit one independently verified
adoption per Main Task, with required review, while closing further delegation.
An attribution-only mismatch follows the same closure and validation rules.
Neither counts as verified route savings. Preserve observations after adoption.
Track provider, model, effort, profile, context, sandbox, permissions, Skills,
MCPs, tools and continuation identity. See
[Delivery lifecycle](docs/sdd/delivery-lifecycle.md).

## 10. Recoverability and publication

Delegated writes occur only in disposable isolated workspaces, never the user's
shared checkout. Capture exact relevant tracked, dirty, untracked, type, mode,
symlink and dependency state. A worktree alone is not a sandbox. Restore or
discard only the attempt's isolated state, never another writer's changes.

Root checks the full diff, scope and affected verification commands, builds the
final integration candidate and obtains required review. Publish only if source
and target/dependency digests still match, under an exclusive integration lease
and recoverable compare-and-apply journal. Multi-file writes are not inherently
atomic. Concurrent changes require Root integration and invalidate affected
evidence; no automatic three-way merge. Unknown ownership or restore conflict
means pending integration, not destructive cleanup.

## 11. Independent review and acceptance

Persistent public Interface, data-structure, permission/security changes and
non-empty worker judgment/gaps trigger fresh review. Actual diff and Root risk
facts govern the trigger; Jev cannot lower it. The same trigger applies to
Root-direct and takeover candidates.

The fixed governance reviewer is fresh gpt-6-astra / medium, without descendants
and never concurrent with a worker. Its packet includes original user intent
independently of the capsule, acceptance IDs, exact final diff, verification
and candidate/dependency digests. It returns ACCEPT, REVISE or RECONSIDER,
never fixes artifacts. Isolation tiers are ENFORCED_READ_ONLY,
BEHAVIORALLY_READ_ONLY and REVIEW_UNAVAILABLE. Behavioral isolation requires
hard read-only to be unnecessary, proven confinement and exact state comparison.

Any mutation voids the verdict. Root cannot waive required review after Jev
failure or budget exhaustion. Missing required evidence leaves delivery
pending/unaccepted. RECONSIDER returns architecture to Root; consult the user
only for unresolved intent or new authorization.

## 12. Lifecycle budgets

All counters are monotonic within one trusted Main Task identity. Labels,
capsule revisions, resumes and transport retries never reset them.

| Counter | Limit |
| --- | --- |
| Semantic Jev decisions | At most 2 per task unit (initial + one correction); none after unit closure |
| HTTP attempts | 2 per decision, bounded by the unit decision cap |
| Worker executions | Normal economic cap 2; hard cap 3 per Main Task |
| Delegated-candidate reviews | At most 1 per candidate; at most 3 |
| Reserved Root-final-candidate review | 1 additional slot; workers cannot consume it |

A third worker is eligible only after execution two failed, safe restoration,
unchanged acceptance, a non-repeated correctable failure class and explicit
third-correction qualification (or frozen research permission for that
experiment). Jev selects it in a new decision. Safety failures, identity
uncertainty, repeated verification/semantic faults and scope thrash always
stop delegation. Root never estimates remaining economic benefit. See
[Delivery lifecycle](docs/sdd/delivery-lifecycle.md) for increment points.

## 13. Decision Receipts

Record preflight/provider failures, Guard denial, Root choice, execution,
adoption/rejection, cancellation and pending delivery. Include selection
evidence, configuration provenance, counters, per-request usage, verification,
review and integration. Missing usage is UNKNOWN, not zero. Receipts are
evidence, never routing authority; corrections use bounded live FailureEvidence,
not historical receipts or account statistics.

Ordinary receipts remain ephemeral. Research persistence uses approved
sanitized fixtures and versioned candidate/question/configuration snapshots.
Digests check integrity; alone they cannot reconstruct input or promise the
same future model answer. See [Decision Receipt](docs/sdd/decision-receipt.md).

## 14. Failure semantics

| Trigger | Result | Level |
| --- | --- | --- |
| Unsafe/ineligible projection, oversize or unknown sizing | No HTTP; close unit routing; Root responsibility | Unit |
| Unavailable, malformed, low confidence or drift | Close unit routing; Root responsibility | Unit |
| Guard DENY or changed pre-spawn evidence | Close unit routing; no substitution or semantic retry | Unit |
| Correctable worker failure / REVISE | Restore isolated state; new Jev decision only within remaining rules | Unit |
| Safety violation or unknown safety | Stop child; preserve evidence; safe isolated recovery; latch Main Task | Main |
| Attribution-only mismatch/unknown | Close unit routing; optionally validate/adopt once; no verified route savings | Unit |
| RECONSIDER, reviewer mutation or unavailable required review | Close unit routing; Root judgment; no unreviewed delivery | Unit |
| Integration conflict | Preserve shared changes; Root integration; revalidate/review as needed | Unit |
| Lost lifecycle state, counter corruption or competing routing authority | Latch Main Task; Root | Main |
| Global worker-execution budget exhausted | Latch Main Task; Root | Main |
| Cancellation | Disarm late results, stop active work, preserve recoverable state; no automatic takeover | As issued |

Root follows existing authorization. Unmet authorization or acceptance gates
may require clarification or pending status.

## 15. Benchmark and qualification

**Quality non-inferiority passes before any economics is evaluated.** Freeze
corpus, strata, metrics, margins, statistical procedures, exclusion/rerun rules
and question/configuration variants before holdout. Collect token data during
runs but select no economic winner until quality passes.

Arms A (pure frontier Root), B (same-session routing if reproducible), C (this
whole policy) use paired initial states and equivalent acceptance standards.
Quality includes completion, blinded acceptance, critical/security/Interface
defects, intervention, restore and retry rates. Failures and unknown outcomes
remain in the analysis. Critical regressions cannot buy token benefit.

**Primary economic evaluation (only after quality passes):** preregistered
one-sided lower confidence bounds on the paired reductions of (a)
frozen-price-weighted delivery cost and (b) frontier-capacity consumption,
including required stratum/multiple-comparison corrections. Weights come from
frozen price data captured in the benchmark release; the runtime never sees
them. Total raw tokens, latency, retry/restore rates and model share are
secondary and reported, never substitutes: raw total-token reduction is not
required, and a cheap-token increase is not failure when weighted cost or
flagship consumption improves. Keep all C assignments in intention-to-treat
accounting; unknown attribution/usage must be conservatively bounded or
prevent qualification.

Explicit research authorization plus a frozen ExperimentManifest waives only
prior economic qualification. All safety, authorization, review and hard
budgets remain. Production requires immutable evidence matching the semantic
contract, Jev/question, projection, host, execution/review templates,
deterministic disjoint task profile and attempt regime. No evidence means no
production delegation. See [Benchmark](docs/sdd/benchmark.md).

## 16. Claims

The architecture aims to reduce quality-constrained delivery economics —
weighted delivery cost and frontier-capacity consumption — while preserving
quality. End-to-end economic savings remain benchmark-dependent; raw total
token counts may legitimately increase. Model share changes, one A/B pair and
static tests are not savings evidence. Claims must identify the qualified
population, uncertainty, coverage and losing strata.

## 17. Identity and scope

Canonical identity is jev-auto-router. The old codex-auto-router identity is
historical; remote migration remains in [plan.md](plan.md) §9.
This revision changes architecture Markdown only; READMEs, images, runtime
and test source are separate implementation/productization work.

## 18. Implementation readiness

P1 implements SDD schemas and [acceptance cases](docs/sdd/acceptance-cases.md).
P2 proves pinned-token sizing and one-Choice normalization. P3 proves a concrete
Root-driven host invocation/evidence chain with a read-only attempt. No real
delegated writes before isolation, recovery, review and publication exist;
no production routing before qualification.

Implementation must carry a code-level execution mode: `probe_read_only`
until the full P4 chain exists, then `delegated_write`. A `delegated_write`
execution is **unconstructible** without baseline, isolation, restore,
verification, review and publication all present — the gate is a type/state
constraint, not a runtime check that can be skipped.

Node cannot call model-side native tools merely by importing a function.
Root invokes available native tools and supplies trusted request-bound
observations. Deterministic fixtures cross the same Interface, without another
model provider or scheduler. See [Architecture](docs/sdd/architecture.md).

## 19. Non-goals

No heuristic worker selector, provider fallback, online token forecast,
automatic Root-model switching, fan-out, cross-task adaptive learning, routine
receipt persistence or Dashboard control loop. Capability expansion and
multi-stage Jev selection need evidence and a new qualification regime.

## 20. Validation

Run npm test, npm run typecheck and git diff --check. Existing prose tests prove
only their assertions, not application or savings. Migrate them to
schema/transition/host-contract acceptance cases during implementation,
including the documented identity-counter defect. Preserve exact wording only
when truthful. Resolve normative links and exercise failure cases through the
public Module Interfaces.
