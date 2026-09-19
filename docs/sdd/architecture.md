# Architecture

Five roles, one automatic selection authority: **Jev chooses; Guard validates;
Codex executes; Root verifies and accepts.** The objective is reduced total
delivery cost and frontier-capacity consumption conditional on non-inferior
quality. Raw token count is a secondary measurement, not the selection goal.

## Modules and Seams

| Module | Interface | Responsibility hidden behind it |
| --- | --- | --- |
| Capsule/projection | Local intent -> capsule + safe RoutingProjection or ineligible | Stable acceptance, ownership, provenance and pre-egress policy |
| Capability Catalog | Trusted host snapshot -> complete candidate snapshot | Freshness, effective inheritance, configuration compatibility |
| JevAdapter | RouteRequest + frozen selection policy + cancellation -> plan or failure | Provider wire schema, sizing, one Choice, pinning and bounded transport |
| Policy Guard | Plan + local GuardContext -> ALLOW(same plan) or DENY | Deterministic authorization, safety, qualification and budgets |
| Delivery lifecycle | Host events + accepted plan -> commands/state/receipt | Counters, isolation, recovery, review and conflict-safe integration |

A Module's Interface includes error modes, evidence requirements and ordering,
not only its TypeScript types. Keep these concerns local; do not distribute
provider parsing or permission reconstruction among callers. No generic
multi-provider router Interface is introduced.

## Authority exceptions

Root authors intent, architecture, decomposition and acceptance. It cannot
select a model or guess economic benefit. Jev chooses among every admitted
complete candidate. Candidate enumeration and qualification are deterministic
eligibility rules, never shape heuristics or a ranked shortlist.

Lifecycle maps failed prerequisites, DENY and exhausted limits to the existing
Root. This fixed fallback is not an alternate-model selector. The fixed fresh
Astra/medium semantic reviewer is a governance role outside worker economics.
It still requires trustworthy runtime evidence and a bounded review budget.

## Root-driven host Adapter

The implementation is a local Module invoked from Root's current task, not a
background scheduler. A Node function cannot invoke model-visible spawn tools
by importing them or naming them in prose. Root invokes the native tool that
the current host actually exposes, then supplies trusted observations.

~~~text
prepare(local intent, capsule, host evidence, lifecycle state)
  -> ineligible | RouteRequest + local GuardContext
route(RouteRequest, selection policy, cancellation)
  -> RoutePlan | RoutingFailure
validate(plan, current GuardContext)
  -> ALLOW(same plan) | DENY(reason)
advance(state, bound host event)
  -> updated state + next command | closed/pending outcome
~~~

Commands are discriminated as capture_baseline, native_worker_start,
native_worker_continue, verify_candidate, native_review_start,
prepare_integration, publish_candidate, stop_child or discard_isolated_state.
They carry request/decision/execution IDs, expected state digests and required
evidence. Root performs commands through observed native tools/filesystem
operations; the library never autonomously starts another model.

Only host-authoritative events can confirm applied configuration, stopped
execution, sandbox grants or continuation identity. Worker prose cannot.
Reject stale, duplicate, cross-task and out-of-order events. A start command
consumes a slot before native invocation; ambiguous invocation does not permit
a second start. Cancellation closes/disarms outstanding IDs before cleanup.

The same Interface accepts deterministic fixture events for tests. Fixtures
are labeled simulation and cannot masquerade as production host evidence.
First runtime integration is a read-only probe demonstrating native invocation,
evidence provenance, fresh-context handling and cancellation. No writable
delegation before independently enforced confinement is demonstrable.

### Trust and execution boundary

TypeScript brands and state constructors prevent accidental misuse inside the
library; they are not a security boundary against a malicious caller. Host
evidence must enter through a trusted host integration, bound to the current
session, configuration, operation and expiry. Worker text, untrusted JSON and
fixtures cannot mint production host evidence. Root-authored intent/summary
attestations establish provenance, not sandbox enforcement. When the host has
no authoritative enforcement surface, production delegation remains unavailable.

The library emits commands; a host bridge executes them. Simulation uses the
same command/event protocol but carries `evidence_mode: simulation` throughout,
and cannot emit a production qualification artifact. A CLI or a native tool
listing alone does not close this integration gap. These boundaries are
explicit readiness gates, not defaults to be filled with optimistic booleans.

## End-to-end flow

1. Root captures original intent/acceptance and a bounded local capsule.
2. Capture authorized isolated baseline; Root pre-runs concrete verification.
3. Freshness-validate host evidence; enumerate complete eligible candidates.
4. Build safe RoutingProjection and token-size it. If no delegate or missing
   qualification, skip Jev and close routing to Root responsibility.
5. Jev's one Choice selects a complete candidate; Adapter normalizes by lookup.
6. Guard validates current local evidence. DENY closes routing; no alternate.
7. Root performs the exact native spawn/resume in an enforced isolated workspace.
8. Record actual application; Root verifies the complete output.
9. Build the final integration candidate; required fresh governance review.
10. Compare-and-publish under proven exclusive integration, or leave pending.
11. Accept the unchanged candidate; otherwise isolated restore and a qualified,
    budgeted Jev correction, or closed routing and Root takeover.

No two children run concurrently and no child delegates. Three worker
executions is the Main Task ceiling. Each registered unit permits two semantic
decisions, with one additional decision only for the qualified third worker
correction described in the lifecycle. Root's final review slot is protected
from worker retries.

## Token locality

Pass local file/diff references to workers and reviewers when authorized;
send Jev compact semantic facts, not copies of these artifacts. Reuse observed
catalog evidence by fingerprint and verification results only when input
digests are unchanged. Root does not independently implement accepted worker
work or duplicate the reviewer's semantic pass. Measure all remaining overhead.

No semantic cache reuses a route for a changed capsule, candidate set or
qualification. No cross-task learning or historical usage feedback is needed.
Large candidate sets, unsafe projections and unsupported hosts end at Root
rather than adding an unqualified heuristic or hierarchy.

## Failure and proof

Closed automatic routing does not mean completed user work. Root still needs
authorization, verification and required review; unavailable gates mean pending.
Receipts explain what happened; they do not control future routing. All host
and performance properties are UNVERIFIED until observed runtime tests and
benchmark qualification establish them. The repository currently ships the
static contract and observer Dashboard only.
