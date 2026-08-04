# Runtime Router Policy

This file is the sole canonical authority for automatic routing. It owns
eligibility, the fixed child tuples, verification, and fallback. `SKILL.md` is a
shallow Adapter. No other document, Dashboard, model history, task label,
script, or agent profile may override it.

`ROOT_DIRECT` is not a route chosen for economy. It is the terminal state of
every failure path in this contract. Any condition below that is missing,
ambiguous, or unverifiable resolves to `ROOT_DIRECT`, except where a section
explicitly downgrades an unobservable signal to recorded residual risk.

## 1. Root condition

Root must be `gpt-5.6-sol` at `medium`, `high`, `xhigh`, `max`, or `ultra`,
confirmed from trusted current-task runtime metadata. A Skill cannot change the
Root model; never assume or claim this prerequisite is satisfied. If it is lower
or unconfirmable, choose `ROOT_DIRECT`.

## 2. Classify by nature, not difficulty

**Judgment work always stays in Root**, regardless of how mechanical it looks:

- resolving requirements and material ambiguity;
- choosing architecture, interfaces, and decomposition;
- **writing the dispatch specification itself**;
- reading the diff and rerunning verification;
- judging review findings and accepting the deliverable;
- external actions (push, PR, sending messages) and conversational turns.

**Implementation work is delegated by default**: writing or changing code,
writing tests, mechanical or repetitive edits, and bounded read-only evidence
gathering.

Do not vary the channel by perceived difficulty. A complex but purely
implementational refactor is delegated. A trivial question that turns on user
intent is not.

## 3. The dispatch gate is a template, not a checklist

Delegation is permitted only when every section below can be filled
**concretely**. If any section cannot, do the work in Root. There is no separate
economic scoring record.

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

No size or cost floor gates delegation in this version. Delegating a trivial
unit wastes a round trip but cannot damage the repository, and any floor set now
would be a guess. Add one only from observed waste.

## 4. Channels and fixed tuples

Exactly one child per Main Task at a time. A child may not create descendants.

```yaml
LUNA:
  model: gpt-5.6-luna
  reasoning_effort: xhigh
  fork_turns: none
TERRA:
  model: gpt-5.6-terra
  reasoning_effort: high
  fork_turns: none
```

Luna requires one of these shapes, verified before dispatch:

- **read-only evidence**: an exact path plus an exact line or time window, with
  no writable path at all; or
- **bounded write**: a single file, or same-directory files of the same kind,
  **and** no change to a public interface, configuration, or dependency,
  **and** verification is one command with a binary result.

Everything else eligible goes to Terra. Never substitute another model, effort,
or context boundary, and never silently downgrade a channel.

## 5. Confirm observed routing before accepting output

Requesting a tuple does not prove it was applied. After dispatch, compare the
child's observed model and effort from runtime metadata against what was
requested. Two cases follow, and they are not interchangeable:

- **Observed and mismatched** — the platform reports a different model or
  effort than requested. Do not accept the output: restore the baseline and
  choose `ROOT_DIRECT`.
- **Unobservable on this host** — the platform exposes no routing metadata for
  the child. Do not discard the output for that reason alone: sections 6 and 7
  re-derive correctness from the artifact itself and do not depend on trusting
  the routing label. Proceed, and record the unverified tuple as residual risk,
  in the same way section 7 records an unverified sandbox.

Discarding paid-for output because the host cannot label it would redo the
work in Root and defeat the purpose of this policy.

## 6. Collect and verify mechanically

A child's own report of success proves nothing by itself; only Root's
independent inspection does. Before adoption:

1. Read the working tree and the complete diff.
2. Confirm only in-scope, owned files changed.
3. Rerun in Root every verification command whose inputs the child's owned
   paths could affect. For a command they could not affect, reuse the result
   recorded at the dispatch gate instead of paying to run it twice.
4. Compare the evidence against the objective, interfaces, and constraints.

This step cannot be skipped, delegated, or satisfied by self-report.

## 7. Semantic review

The child has already ended and its ownership is resolved before any review
starts. Reviewer and worker never run at the same time, so no concurrency
exception is needed.

Mechanical verification cannot catch one specific defect: Root wrote both the
specification and the verification commands, so Root checking its own
specification cannot detect that the specification was wrong.

Run **at most one** semantic review, and only when the change is persistent
(intended for delivery, not exploration) **and** at least one of:

- it touches a public interface, data structure, permission, or security path;
- the child returned a non-empty `JUDGMENT CALLS` or `GAPS`.

Spanning multiple files is not a trigger by itself: most delegated
implementation is multi-file, and file count is a mechanical property section 6
already inspects. The triggers above are the signals that the specification —
not just the code — may be wrong.

Otherwise section 6 is sufficient. Skipping review under these rules is not a
claim that the change was reviewed.

Dispatch the reviewer with the fixed tuple:

```yaml
REVIEWER:
  model: gpt-5.6-sol
  reasoning_effort: medium
  fork_turns: none
```

Give it the objective, the exact file list, the complete diff or explicit
base/head revisions, the verification evidence, and the constraints. Instruct
it to judge two things: whether the diff is sound, and whether the objective
and constraints themselves were adequate for the stated outcome. Checking only
diff-against-specification would repeat section 6 and miss the one defect this
review exists to catch. Instruct it
to stay strictly read-only: it must not create, modify, delete, or format files,
must not implement fixes, must not broaden scope, and must not delegate.

It returns exactly one verdict — `ACCEPT`, `REVISE`, or `RECONSIDER` — plus free-text
findings with precise file references. No finding ledger or stable identifiers
are required.

Isolation is observed, never assumed. Two creation paths exist, and neither may
be described as the other:

- **Named profile, when available.** If the spawn surface exposes a parameter
  that selects an installed custom agent, create the reviewer from
  `agents/codex-auto-router-sol-reviewer.toml`, installed by
  `scripts/install-reviewer-agent.sh`. Its requested `read-only` sandbox may
  then be honored. This path is optional hardening, not a prerequisite.
- **Per-spawn parameters, always available.** Otherwise create the reviewer with
  per-spawn model, effort, and `fork_turns`, placing its instructions in the
  spawn message. Its sandbox is inherited from Root.

Neither the profile, its installer, nor its `--check` proves that a reviewer was
spawned, that its context was fresh, or that any isolation took effect. Review
may proceed only when hard isolation is not required, the prompt forbids edits,
and Root compares exact before-and-after state of the repository and artifacts.
Report the broader sandbox as residual risk. Never describe the review as
enforced read-only unless the observed sandbox policy type is exactly
`read-only`. If any mutation occurred, stop the lane; do not hide or repair it
under the verdict.

Any change made after a verdict voids that verdict. Either review again or treat
the change as unreviewed.

## 8. Failure, correction, and takeover

- `ACCEPT`, or review not triggered and section 6 passed → adopt.
- `REVISE`, or section 6 failed → **restore the baseline, correct the
  specification, and dispatch one new child.** The corrected dispatch is a fresh
  child starting from the restored baseline, not a resumed one, so it needs no
  same-child follow-up capability. The retry's specification must differ from
  the one that failed — resending the same instructions and hoping for a
  different result is not a correction. Never silently repair the child's
  patch to avoid an unresolved correction.
- Still failing after that one corrected dispatch → restore the baseline and
  continue in Root under the original authorization.
- `RECONSIDER` → stop, return to architecture, and consult the user.

At most two dispatches per Main Task: the original and one corrected retry.
Failed, timed-out, unverifiable, and rejected dispatches all count. No
replacement child is created automatically, and no channel converts into
another.

Restoring a candidate and continuing in Root is not termination of the user's
goal and needs no new authorization. Broadening scope, changing the
architecture, or starting new delegated work does.

## 9. Never routing input

Dashboard, `ccusage`, `src/credit.ts`, Credit or usage estimates, model mix,
historical token share, and latency are never inputs to a channel decision or
to continuation. They are reporting surfaces only. Elapsed time may be a
user-facing constraint but never a routing input.

## 10. Boundaries

Route notes are commentary. They are not durable state, are never written to a
policy file or sent to a Dashboard, and are never read as input to a later
decision. Lifecycle state is transient and Root-owned; a new stateless session
cannot know a prior one, so missing, incomplete, conflicting, or ambiguous state
ends delegation and continues in Root.

## 11. Design rationale

This policy optimizes for **efficiency**: spend the strong Root model only
where its judgment is actually needed, and route everything else to the
cheapest channel that can still be verified. That driver shapes every
deliberate choice below:

- **A cheaper channel is selected by verifiable task shape**, not by an
  impression of difficulty — so routine work never defaults to the strongest
  model out of caution.
- **Every writable path gets a baseline before dispatch**, and restore is the
  primary recovery from a bad result — a failed attempt is undone, not
  re-specified in place.
- **The dispatch limit is two per Main Task**: the original attempt and one
  corrected retry. Unbounded retries would erase the cost savings this policy
  exists to capture.
- **Semantic review is triggered by risk, not run on every change.** Running
  it unconditionally would spend the strong model on exactly the work this
  policy is trying to avoid spending it on; skipping it under these rules
  never counts as having reviewed the change.
- **Exactly one child runs at a time, with no descendants**, keeping the
  ownership and recovery model in section 3 simple enough to verify by
  inspection.
- **Every failure path resolves to `ROOT_DIRECT`**, not to a lane-specific stop
  state, so there is exactly one terminal condition to reason about.
- **Usage, credit, and Dashboard data are barred from routing input**, so the
  channel decision stays reproducible from the task itself and never drifts
  with unrelated account state.
