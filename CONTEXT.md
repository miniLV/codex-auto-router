# Shared Context

This glossary describes the Jev Auto Router contract. The
[Runtime Router Policy](skills/jev-auto-router/references/routing-policy.md)
is the sole canonical deep runtime Module; this file is explanatory context
and cannot define a route.

| Term | Definition |
| --- | --- |
| Main Task | The user-visible task in which the request is received and the final result is delivered. |
| Frontier Root | The supervisor role: owner of requirements, ambiguity resolution, architecture, decomposition, the Task Capsule, external actions, verification judgment, and final acceptance. Root contains no route-selection heuristic. |
| Root Model | The model selected for the Main Task. Automatic routing never changes it. |
| Root Condition | Automatic routing requires trusted current-task evidence for `gpt-6-astra` or `gpt-5.6-sol` at `medium`, `high`, `xhigh`, `max`, or `ultra`. Any other or unverified tuple means `ROOT_DIRECT`. |
| Jev | The sole automatic route-selection intelligence: a strategic, core dependency selecting root vs delegate, model, reasoning effort, agent, Skills, MCPs, tool scope, context strategy, and continuation strategy. Never advisory, never optional, never a second opinion. |
| JevAdapter | The single thin seam between this repository and the Jev API: request serialization, response normalization, timeout/error mapping. The only place Jev's wire schema appears; the only provider. |
| Runtime Capability Catalog | The truthful inventory of what the runtime actually provides now: models, agents, Skills, MCPs, tools, context modes — each with an evidence class. `UNKNOWN` evidence means absent. Jev may select only catalog entries. |
| Task Capsule | The bounded Root-authored handoff packet for one implementation unit: objective, owned paths, interfaces, constraints, authorization boundary, success criteria, verification, baseline, risk flags, side-effect class, context references. An economic boundary: never a copy of the whole Root conversation. |
| Dispatch template | The five-section worker-facing projection of the capsule (OBJECTIVE, FILES AND OWNERSHIP, INTERFACES, CONSTRAINTS, VERIFICATION) plus its structured RETURN fields. Delegation is permitted only when every section passes the Policy's three mechanical checks. |
| RouteRequest / RoutePlan | The normalized internal schemas: capsule + catalog + attempt state (+ failure evidence) in; decision, model, effort, agent, capabilities, context mode, confidence, risk, benefit class, reason codes out. `decision: root` is a first-class plan. No invented token/dollar forecasts. |
| Policy Guard | The deterministic validator of every RoutePlan: unconditional veto, zero alternate-routing authority. Verdicts are exactly `ALLOW(RoutePlan)` or `DENY(reason) → Root`. It never selects, substitutes, or downgrades. |
| Route Decision | Exactly `ROOT_DIRECT` or a delegated execution of a Guard-accepted RoutePlan. There are no fixed lanes and no shape heuristics. |
| Execution contract | Requested versus observed model, effort, agent, context mode, sandbox, permissions, Skills, MCPs, tool scopes, continuation identity — each in exactly one state (`requested_match`, `requested_mismatch`, `routing_metadata_unobservable`, `accepted_under_unobservable`, `permission_scope_violation`, `context_boundary_violation`). UNKNOWN is never MATCH. |
| Baseline | The captured state of every writable path before dispatch. Restore from the baseline is the primary recovery from a failed or rejected result. |
| Mechanical verification | Root's own adoption gate: read the complete diff, confirm scope, and rerun the verification commands the child's owned paths could affect. It is never satisfied by the child's self-report. |
| Semantic review | The risk-triggered `gpt-6-astra` / `medium` fresh-context review of one persistent candidate. Each candidate receives at most one; the task review budget is bounded by the execution budget. It judges both the diff and whether the specification itself was adequate, and returns exactly `ACCEPT`, `REVISE`, or `RECONSIDER`. |
| Isolation tiers | Reviewer isolation described from observed evidence only: `ENFORCED_READ_ONLY`, `BEHAVIORALLY_READ_ONLY`, or `REVIEW_UNAVAILABLE`. Tier 2 is never labeled enforced; any mutation after a verdict voids it. |
| Attempt economics | Hard worker execution ceiling 3 per Main Task; normal automatic economic ceiling 2. A third execution requires benchmark qualification for that task profile. Immediate-takeover conditions end delegation early. |
| Continuation | Same-worker correction, selectable only when runtime evidence proves the handle, worker identity, ownership, and model/runtime contract. Unprovable continuation is absent from the catalog. |
| Decision Receipt | The structured evidence record per routed attempt (inputs, plan, verdicts, contracts, outcome, usage). Evidence only — never routing authority. Normal routing state is ephemeral. |
| Residual risk | A condition the host cannot make observable, such as unobservable routing metadata or an unenforced reviewer sandbox. It is recorded and reported — never silently assumed safe, and never a reason by itself to discard independently verified output. |
| Dashboard | Dashboard, `ccusage`, `src/credit.ts`, and any Credit or usage estimate are independent observers or product implementation, never routing input or control. |
| Static contract | Documentation, metadata, and static tests that validate shapes and boundaries. They do not prove runtime enforcement. |
| Runtime proof | Evidence from a real platform invocation and Root verification; it is separate from static contract checks. |
| Competing routing authority | Any other routing or orchestration policy governing the current task. The Auto Router stands down to `ROOT_DIRECT` instead of competing with it. |

The contract deliberately keeps route selection out of this repository: no
heuristic classifier, no route-rule registry, no LLM-based selector, no
telemetry control loop, and no Dashboard control artifact. The only automatic
selector is Jev, reached through one adapter; the only deterministic
governance is the Policy Guard; execution is Codex-native; judgment and
acceptance stay in Root.
