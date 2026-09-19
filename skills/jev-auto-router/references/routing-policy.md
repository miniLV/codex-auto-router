# Runtime Routing Policy

This file is the sole canonical authority for automatic routing under the Jev
Auto Router architecture. It owns the runtime contract: eligibility, the Task
Capsule gate, the Capability Catalog requirements, Jev routing, the Policy
Guard, the execution contract, verification, review, correction, budgets, and
fallback. `SKILL.md` is a shallow Adapter. No other document, Dashboard, model
history, task label, script, or agent profile may override it.

The division of authority is fixed and singular:

```text
Jev chooses.  The Guard validates.  Codex executes.  Root verifies.
```

`ROOT_DIRECT` is a first-class outcome, not a failure: Root executes the unit
itself with the same verification discipline. It is also the terminal state
of every failure path in this contract. Any condition below that is missing,
ambiguous, or unverifiable resolves to `ROOT_DIRECT`, except where a section
explicitly downgrades an unobservable signal to recorded residual risk.

## 1. Root condition

Automatic routing requires Root to be `gpt-6-astra` or `gpt-5.6-sol` at
`medium`, `high`, `xhigh`, `max`, or `ultra`, confirmed from trusted
current-task runtime metadata. A Skill cannot change the Root model; never
assume or claim this prerequisite is satisfied. If it is another model, lower,
or unconfirmable, choose `ROOT_DIRECT`.

## 2. Root owns judgment; Jev owns selection

**Judgment work always stays in Root**, regardless of how mechanical it looks:

- resolving requirements and material ambiguity;
- choosing architecture, interfaces, and decomposition;
- authoring the Task Capsule and the dispatch specification itself;
- reading the diff and rerunning verification;
- judging review findings and accepting the deliverable;
- external actions (push, PR, sending messages) and conversational turns.

Implementation units — writing or changing code, writing tests, mechanical or
repetitive edits, bounded read-only evidence gathering — are routed through
this Policy. Root does not pre-judge their destination: **there is no
"single-file goes to a cheap lane, everything else goes to a bigger lane"
heuristic anywhere in this contract.** Whether an implementation unit executes
in Root or in a delegated child, and with which model, effort, agent, and
context mode, is decided by Jev and validated by the Guard.

## 3. The Task Capsule gate is a template, not a checklist

Before routing, Root converts the decomposed unit into a bounded **Task
Capsule**. Its worker-facing projection is the five-section dispatch
template; delegation is permitted only when every section can be filled
**concretely**. If any section cannot, the unit is not routable to a child
and Root does the work.

```text
OBJECTIVE
<Observable outcome and why it matters.>

FILES AND OWNERSHIP
You own only:
- <exact file or module>

Other work may land in this repository while you run. Keep changes made by
others intact, do not undo anything outside your stated objective, and adjust
to what is already there instead of assuming a clean starting point. Stay
inside the paths listed above.

INTERFACES
- <Signatures, types, schemas, commands, or behavior that must stay compatible.>

CONSTRAINTS
- <Repository conventions, safety boundaries, excluded scope, settled decisions.>

VERIFICATION
- Run: <exact command>
  Success: <concrete expected result>
- Inspect: <exact file, diff, or generated artifact>
  Success: <concrete expected evidence>

RETURN
STATUS: complete | partial | blocked
CHANGES: <file-by-file summary taken from the actual diff>
VERIFIED: <exact commands plus concrete output evidence>
JUDGMENT CALLS: <decisions the specification left open, or none>
GAPS: <unfinished work, ambiguity, or none>
A completion claim without evidence is invalid.
```

"Filled concretely" is not a judgment call. It means these three checks pass,
and each is a yes or no:

1. **Every owned path resolves.** Each entry under `FILES AND OWNERSHIP` is a
   literal path that either exists in the repository or is explicitly marked
   new. No globs, no "the relevant files", no directory used as a catch-all. The
   set is pairwise non-overlapping: no entry is a prefix of another.
2. **Every verification command has already been executed by Root.** Before
   dispatch, Root runs each `Run:` command and records its actual result. A
   command that cannot be executed is not a verification command, and a section
   with no executable command blocks the dispatch. This also captures the
   behavioral before-state as a side effect.
3. **The repository is safe and a baseline exists.** No active merge or rebase
   conflict, no unresolved ownership or scope ambiguity, and a captured baseline
   for every writable path, so any owned path can be restored or discarded.

`INTERFACES` and `CONSTRAINTS` must contain either named concrete items or the
literal word `none`. An empty or hedging section is not filled.

The capsule is also an **economic boundary**: it must not copy the entire Root
conversation by default. Its size is measured, recorded in the Decision
Receipt, and counted against end-to-end cost by the benchmark. During
correction the capsule may only narrow; broadening ownership, authorization,
or success criteria requires new user authorization.

## 4. The Runtime Capability Catalog

Routing decisions are constrained by what the runtime can actually do **now**.
Before each routing decision, construct (or freshness-validate) a catalog of
observed capabilities: models with their supported reasoning efforts and
spawn support; agent profiles with their model constraints, sandbox, and
permissions; Skills; MCPs with a read/write/external-action class; tools with
a permission class; and the context modes genuinely supported (fresh;
continuation only where a handle and worker identity are observable).

- Every catalog entry carries an evidence class. `UNKNOWN` evidence means the
  capability is **absent** for selection purposes; a capability observed in a
  previous session confers nothing.
- Discovery failures omit capabilities; they never fabricate them.
- The catalog contains no quota, account, `ccusage`, Credit, model-mix, or
  latency data. Those are observers, never routing inputs (section 11).
- The catalog digest is recorded in the Decision Receipt so any route is
  reproducible against the exact capability set it was selected from.

Jev may select only entries present in this catalog. A RoutePlan referencing
an absent or invented capability is invalid and the Guard denies it. There is
no silent substitution: if a requested capability is unavailable, the outcome
is a denied plan and Root execution, never a different lane chosen on Jev's
behalf.

## 5. Jev routing

For every routable unit, the flow is exactly:

```text
RouteRequest (capsule + catalog + attempt state + failure evidence)
  -> JevAdapter -> Jev
  -> normalized RoutePlan
  -> Policy Guard (section 6)
```

Jev is the only automatic route-selection intelligence. It may select root
execution, delegated execution, model, reasoning effort, agent, Skill set, MCP
set, tool scope, context strategy, and continuation strategy. A RoutePlan with
`decision: root` is a valid, first-class plan: Root then executes the unit
with the capsule's verification discipline and no child is spawned.

The JevAdapter is the only place Jev's wire schema appears. It maps every
provider failure to an explicit state and **never invents a route**:

- `UNAVAILABLE` — timeout, network error, 429/529/5xx;
- `MALFORMED` — schema-invalid response, unexpected model id, alias drift;
- `LOW_CONFIDENCE` — confidence below the Guard's frozen floor.

Every adapter failure state means automatic delegation is unavailable and
resolves to `ROOT_DIRECT`. There is no heuristic fallback route, no legacy
lane table, and no second selector anywhere in this contract. A RoutePlan
carries calibrated confidence, risk, a benefit **class**, and stable reason
codes — never an invented token or dollar forecast.

## 6. The Policy Guard

The Guard is deterministic. It validates the RoutePlan and holds unconditional
veto authority with **no alternate-routing authority**: it never selects,
substitutes, or downgrades a plan. Its verdicts are exactly:

```text
ALLOW(RoutePlan)   — execute exactly the plan
DENY(reason) → Root — Root executes; the reason is recorded
```

The Guard denies a plan unless every check passes:

1. the RoutePlan schema is valid;
2. route confidence meets the frozen requirement;
3. every requested capability exists in the catalog with non-`UNKNOWN`
   evidence;
4. the requested model supports the requested reasoning effort;
5. the requested context mode is supported, and continuation names a provable
   target;
6. task ownership is bounded (capsule paths resolve, non-overlapping);
7. user authorization covers the action class and side-effect class;
8. verification is concrete (pre-run commands exist; non-empty);
9. every writable target has a recoverable baseline;
10. the permission set is least-privilege enough for the unit;
11. there is no unauthorized external side effect (push, PR, messaging,
    network writes beyond authorization);
12. there is no forbidden child delegation or fan-out;
13. the benchmark profile permits automatic routing for this task shape;
14. the attempt budget remains (economic ceiling respected, hard ceiling not
    exhausted);
15. the review budget remains;
16. a requested continuation target is genuinely observable.

Guard thresholds are frozen per benchmark release; they are never tuned per
task at runtime, and the Guard never reads Dashboard, `ccusage`, credit,
quota, model-mix, or latency data. A `DENY` never produces a modified plan:
Root decides what to do — execute directly, fix the capsule, or re-route with
new information.

Until a task profile holds frozen benchmark qualification, check 13 fails for
it by default and its units execute in Root. This is the benefit boundary:
safety eligibility is not an economic claim.

## 7. The execution contract: requested versus observed

Execution of an accepted plan happens through native spawn parameters: the
child receives the plan's model, reasoning effort, agent/profile, and context
mode per spawn, and a fresh context is `fork_turns: none`. Nothing is
inherited implicitly — which is exactly why the comparison below is
mandatory.

Requesting a spawn configuration does not prove it was applied. For every
delegated execution, compare the requested against the observed: model,
reasoning effort, agent/profile, context mode, sandbox, permissions, Skills,
MCPs, tool scopes, and continuation identity. Each dimension records exactly
one state:

```text
requested_match
requested_mismatch
routing_metadata_unobservable
accepted_under_unobservable
permission_scope_violation
context_boundary_violation
```

**UNKNOWN is never MATCH.** Two consequences follow, and they are not
interchangeable:

- **Artifact correctness is separate from route/cost attribution
  correctness.** A more expensive unexpected model may produce a valid
  artifact but invalid savings evidence; a run with `requested_mismatch` or
  `routing_metadata_unobservable` is excluded from verified-savings evidence
  even when its artifact is adopted.
- **A weaker or unauthorized permission, or an execution-scope violation, is a
  stronger safety failure.** It does not merely taint attribution: restore the
  baseline when necessary, stop automatic delegation for this task, and let
  Root take over.

A host that exposes no routing metadata does not cause verified output to be
discarded: mechanical verification and semantic review re-derive correctness
from the artifact itself. Record the unverified dimensions as residual risk,
adopt at most once under `accepted_under_unobservable`, and never count the
run as verified savings.

## 8. Mechanical verification

A child's own report of success proves nothing by itself; only Root's
independent inspection does. Before adoption:

1. Read the working tree and the complete diff.
2. Confirm only in-scope, owned files changed.
3. Rerun in Root every verification command whose inputs the child's owned
   paths could affect. For a command they could not affect, reuse the result
   recorded at the capsule gate instead of paying to run it twice.
4. Compare the evidence against the objective, interfaces, and constraints.

This step cannot be skipped, delegated, or satisfied by self-report.

## 9. Semantic review

The child has already ended and its ownership is resolved before any review
starts. Reviewer and worker never run at the same time, so no concurrency
exception is needed.

Mechanical verification cannot catch one specific defect: Root wrote both
the Task Capsule and the verification commands, so Root checking its own
specification cannot detect that the specification was wrong.

Run **at most one** semantic review for each candidate, and only when the
change is persistent (intended for delivery, not exploration) **and** at least
one of:

- it touches a public interface, data structure, permission, or security path;
- the child returned a non-empty `JUDGMENT CALLS` or `GAPS`.

Spanning multiple files is not a trigger by itself. The review budget is
bounded by the execution budget (section 10): one review per candidate, and
no more reviews than the hard execution ceiling allows.

Dispatch the reviewer fresh with the fixed role:

```yaml
REVIEWER:
  model: gpt-6-astra
  reasoning_effort: medium
  fork_turns: none
```

Give it the objective, the exact file list, the complete diff or explicit
base/head revisions, the verification evidence, and the constraints. Instruct
it to judge two things: whether the diff is sound, and whether the objective
and constraints themselves were adequate for the stated outcome. Instruct it
to stay strictly read-only: it must not create, modify, delete, or format
files, must not implement fixes, must not broaden scope, and must not
delegate.

It returns exactly one verdict — `ACCEPT`, `REVISE`, or `RECONSIDER` — plus
free-text findings with precise file references. No finding ledger or stable
identifiers are required.

Isolation is observed, never assumed. Two creation paths exist, and neither
may be described as the other:

- **Named profile, when available.** If the spawn surface exposes a parameter
  that selects an installed custom agent, create the reviewer from
  `agents/jev-auto-router-astra-reviewer.toml`, installed by
  `scripts/install-reviewer-agent.sh`. Its requested `read-only` sandbox may
  then be honored. This path is optional hardening, not a prerequisite.
- **Per-spawn parameters, always available.** Otherwise create the reviewer
  with per-spawn model, effort, and `fork_turns`, placing its instructions in
  the spawn message. Its sandbox is inherited from Root.

Report the observed isolation tier and never strengthen it:

- `ENFORCED_READ_ONLY` — the observed runtime policy proves read-only
  isolation (observed sandbox policy type exactly `read-only`);
- `BEHAVIORALLY_READ_ONLY` — hard isolation is unavailable and not required;
  the reviewer is forbidden to mutate, and an exact before/after state
  comparison proves no mutation. Report the broader sandbox as residual risk.
  Never describe this tier as enforced read-only.
- `REVIEW_UNAVAILABLE` — the required isolation cannot be demonstrated, the
  runtime evidence is incomplete, or the reviewer mutated state. Stop the
  lane; do not hide or repair a mutation under the verdict.

Neither the profile, its installer, nor its `--check` proves that a reviewer
was spawned, that its context was fresh, or that any isolation took effect.

Any change made after a verdict voids that verdict. A corrected candidate is
a new candidate: it must be verified mechanically and, when the trigger
applies, reviewed independently within the remaining budget.

## 10. Failure, correction, continuation, and budgets

- `ACCEPT`, or review not triggered and section 8 passed → adopt.
- `REVISE`, or section 8 failed → **restore the baseline first**, then
  decide. Root produces structured failure evidence (what was requested, what
  was observed, which checks failed, what the diff showed). Jev receives the
  original capsule, the failure evidence, the remaining capabilities, and the
  attempt state, and chooses: Root takeover, `continue_same_worker`,
  `fresh_worker`, or a different model/agent/capability. A corrected
  specification must differ from the one that failed; never resend the same
  instructions, and never silently repair the child's patch to avoid counting
  a failed attempt.
- `RECONSIDER` → stop, return to Root architecture and judgment, and consult
  the user. Never blindly retry workers against a specification the reviewer
  found inadequate.

**Same-worker continuation is permitted only when runtime evidence proves**
a valid continuation handle, worker identity matching the original,
unchanged ownership, and a re-confirmable model/runtime contract. If
continuation cannot be proven, it is unavailable to Jev — the catalog omits it
— and correction uses a fresh child or a Root takeover.

**Attempt economics.** The budget is counted in worker executions, and
dispatch labels do not reset it:

- hard worker execution ceiling: **3** per Main Task;
- normal automatic economic ceiling: **2** — the initial execution plus at
  most one automatic correction;
- a **third** execution requires explicit benchmark qualification for that
  task profile; otherwise Root takes over.

Take over immediately on: the same verification command failing twice; the
same semantic finding recurring; scope thrash; a permission violation;
execution identity becoming uncertain; the second automatic execution
failing; or the remaining expected benefit no longer being positive or being
materially uncertain. The safety budget is not consumed merely because it
exists.

Exactly one child runs at a time. A child may not create descendants.
Restoring a candidate and continuing in Root is not termination of the
user's goal and needs no new authorization; broadening scope, changing the
architecture, or starting new delegated work does.

## 11. Never routing input

Dashboard, `ccusage`, `src/credit.ts`, Credit or usage estimates, account
quota, model mix, historical token share, and latency are never inputs to a
routing decision, to the Guard, or to continuation. They are reporting
surfaces only. Elapsed time may be a user-facing constraint but never a
routing input.

## 12. Boundaries, receipts, and coexistence

Every routed attempt can produce a structured **Decision Receipt**: task unit
identity and digest, catalog digest, the Jev request digest, the normalized
RoutePlan, confidence, risk, benefit class, reason codes, the Guard verdict
and any rejection reason, the requested and observed execution contracts,
attempt index, continuation mode, verification result, review tier and
verdict, restore/takeover, final outcome, and usage. Receipts are evidence,
never routing authority: nothing reads a receipt to decide a future route.
Normal routing state is ephemeral and Root-owned; only benchmark/research mode
persists sanitized receipts. A new stateless session cannot know a prior one,
so missing, incomplete, conflicting, or ambiguous state ends delegation and
continues in Root.

If a competing routing or orchestration authority (a same-session router, a
proxy router, another auto-router Skill) governs the current Main Task, this
Policy stands down to `ROOT_DIRECT` instead of competing with it.

## 13. Design rationale

This policy optimizes for **trustworthy routing**: intelligence decides,
determinism governs, execution is recoverable, and acceptance is independent.

- **Jev is the sole selector** because route choice is a judgment under
  uncertainty: a typed decision model with calibrated probabilities beats a
  hand-written shape classifier and can grow to agents, Skills, and MCPs.
- **The Guard validates and never chooses** so there is exactly one selector
  and one terminal fallback (`ROOT_DIRECT`) to reason about; governance is
  deterministic and auditable.
- **The catalog constrains selection** because routing into a capability the
  runtime cannot honor produces failed or silently substituted execution —
  both contract violations.
- **The capsule is bounded** because duplicated context erases routing
  savings; its cost is measured, not assumed free.
- **Every writable path gets a baseline before dispatch**, and restore is the
  primary recovery — a failed attempt is undone, not repaired in place.
- **Requested versus observed is explicit** because real hosts drift (and have
  regressed); UNKNOWN is never MATCH, and safety violations outrank
  attribution taint.
- **Mechanical verification and semantic review are distinct**: the first
  proves the artifact matches the capsule; the second can catch a capsule
  that was wrong. Both are Root-owned; neither is ever satisfied by
  self-report.
- **Economics are benchmark-qualified** because a cheaper lane executing a
  task says nothing until the whole delivery cycle — capsule, routing,
  verification, review, retries — is measured; quality passes before
  economics are even evaluated.
- **Usage, credit, and Dashboard data are barred from routing input**, so
  decisions stay reproducible from the task itself and never drift with
  unrelated account state.
