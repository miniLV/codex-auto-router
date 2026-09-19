# Delivery lifecycle

The lifecycle governs one delegated execution from baseline to acceptance.
It preserves this repository's strongest invariant: **delegated writes are
recoverable**, and worker self-report never equals acceptance.

## Sequence

```text
capture baseline for every owned writable path
→ execute the accepted RoutePlan (one child, fresh unless continuation proven)
→ record requested-vs-observed execution contract
→ Root mechanical verification (diff, scope, rerun)
→ fresh independent semantic review when triggered (isolation tier observed)
→ Root confirms reviewed state unchanged
→ Root final acceptance | restore + correction/takeover
```

## Requested vs observed execution contract

Track requested against observed for: model, reasoning effort, agent/profile,
context mode, sandbox, permissions, Skills, MCPs, tool scopes, continuation
identity.

State classes:

```text
requested_match
requested_mismatch              (weaker or unauthorized — safety failure)
routing_metadata_unobservable   (host exposes nothing)
accepted_under_unobservable     (adopted once, recorded as residual risk)
permission_scope_violation
context_boundary_violation
```

**UNKNOWN is never MATCH.**

- Artifact correctness and route/cost attribution correctness are separate. A
  more expensive unexpected model may produce a valid artifact but invalid
  savings evidence.
- A weaker/unauthorized permission or execution-scope violation is a stronger
  safety failure: reject, restore, and stop automatic delegation for the task.
- A mismatch observed at adoption time excludes the run from verified-savings
  evidence even when the artifact is adopted.

## Baseline and restore

- Baseline captured pre-dispatch for every owned writable path.
- On reject/failure: **restore first**, then decide correction vs takeover.
- Never invisibly repair a rejected patch to avoid counting a failed attempt.
- Root takeover after restore stays within original authorization unless
  requirements, scope, or architecture materially changed.

## Mechanical verification (Root's own gate)

1. Read the working tree and the complete diff.
2. Confirm only owned, in-scope paths changed.
3. Rerun every verification command the owned paths could affect; reuse
   pre-dispatch results only for unaffected commands.
4. Compare against objective, interfaces, constraints.
5. Cannot be delegated or satisfied by the child's self-report.

## Fresh semantic review

Distinct from mechanical verification: Root wrote both the specification and
the verification commands, so only an independent fresh-context reviewer can
catch a specification defect.

- Risk-triggered; at most one review per candidate; review budget bounded per
  Main Task (see budgets).
- Reviewer judges both the diff and whether the specification itself was
  adequate; returns exactly `ACCEPT | REVISE | RECONSIDER`; never implements.
- Reviewer is fresh-context, independent of the worker, no descendants.
- **Any mutation after a verdict voids the verdict.** A corrected candidate is
  a new candidate.

### Observed isolation tiers

| Tier | Meaning | Requirement |
| --- | --- | --- |
| `ENFORCED_READ_ONLY` | Observed runtime policy proves read-only isolation | Observed sandbox policy exactly read-only |
| `BEHAVIORALLY_READ_ONLY` | Hard isolation unavailable; reviewer forbidden to mutate by instruction; exact before/after state proves no mutation | State comparison evidence |
| `REVIEW_UNAVAILABLE` | Isolation cannot be demonstrated / reviewer mutated state | Stop the lane; never label Tier 2 as Tier 1 |

## Correction and continuation

After a failed candidate Root produces structured failure evidence. Jev
receives original capsule + failure evidence + remaining capabilities + attempt
state and may choose:

- Root takeover;
- `continue_same_worker` (context-preserving correction);
- `fresh_worker`;
- a different model/agent/capability.

`continue_same_worker` is permitted **only** when runtime evidence proves:

1. a valid continuation handle exists;
2. worker identity matches the original;
3. ownership is unchanged;
4. the required model/runtime contract is re-confirmable.

If continuation cannot be proven, it is unavailable to Jev — the catalog omits
it. There is no "assume it worked".

## Attempt economics

- Hard worker execution ceiling: **3** (initial + up to two corrections).
- Normal automatic economic ceiling: **2** (initial + one automatic
  correction).
- A third execution requires explicit benchmark qualification for that task
  profile; otherwise Root takes over.
- Immediate takeover candidates: repeated same verification failure; repeated
  semantic finding; scope thrash; permission violation; execution identity
  uncertain; second automatic execution failed; remaining expected benefit no
  longer positive or materially uncertain.
- Do not consume the safety budget merely because it exists.

## Corrupted/degraded execution surfaces

Missing, incomplete, or ambiguous lifecycle state ends delegation and
continues in Root. A stateless session cannot know a prior one.
