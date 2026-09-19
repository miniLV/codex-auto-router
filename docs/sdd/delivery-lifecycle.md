# Delivery lifecycle

This Module owns monotonic task state, safe recovery, acceptance and fixed
fallback. It never chooses an alternative model.

## State and counters

Main Task identity comes from the trusted host and is not generated anew by a
capsule, retry or user status message. Unknown/conflicting state closes routing.
Counters are monotonic and survive every same-task resume.

| Counter | Increment point | Ceiling |
| --- | --- | --- |
| semantic_decisions | Before submitting a new semantic request to Adapter | 3 per Main Task |
| http_attempts | Before each outbound provider attempt | 2 per decision; 6 per Main Task |
| worker_executions | Before native start/resume may run an instruction | Economic 2, hard 3 |
| delegated_reviews | Before a governance review of a delegated final candidate | 1 per candidate, maximum 3 |
| root_review_used | Before reviewing a Root-direct/takeover final candidate | One protected additional slot |
| integration_attempts | Before compare-and-apply | Recorded; no autonomous retry on conflict |
| attribution_exception_used | Before adopting unattributed/misattributed output | At most once per Main Task |

A native invocation that fails conclusively before creating a child still
consumes its reserved worker slot; ambiguity never refunds a slot. A resumed
worker turn is an execution. Reviewer turns do not consume worker slots.
Transport retries do not create semantic decisions; candidate IDs do not reset
any counter. Reservation is local transactional state, not free-form prose.

## Canonical transitions

| State/event | Next action |
| --- | --- |
| OPEN, prerequisites or qualifying profile missing | Close automatic routing; Root responsibility; no Jev call |
| OPEN, complete request | Reserve decision; Adapter's bounded HTTP sequence |
| Provider failure / low confidence / Guard DENY / stale evidence | Close routing; Root; never another semantic request |
| Jev root plan | Close routing; Root implements against original acceptance |
| Jev delegate plan + all checks | Reserve execution; native child in confined isolated workspace |
| Candidate passes verification and any required review | Integrate unchanged final candidate; accept unit |
| Correctable verification failure or REVISE, budgets remain | Restore isolated baseline; record bounded failure; another Jev decision |
| Repeated verification/semantic fault, scope thrash, safety/identity violation, RECONSIDER | Close routing; safe recovery; Root judgment |
| Execution two fails with eligible third-correction evidence | Keep OPEN solely for that correction and a fresh Jev decision |
| Execution two fails without that evidence, or execution three fails | Close routing; Root |
| Required review unavailable/exhausted or review mutation | Close routing; unaccepted candidate; Root may use its reserved review if available |
| Integration conflict | Close routing; preserve shared state; Root builds a new final candidate |
| Cancellation | Close/disarm; stop active child; no implicit Root execution |

Accepted units do not reset budgets. Another decomposed unit may route only if
the task is still OPEN and budgets remain. The third slot cannot start a new
unit: it is exclusively a qualified correction after execution two failed.
No new automatic delivery cycle is smuggled in under renamed units.

Third-correction qualification identifies the exact non-repeated failure class
(verification, semantic_revision or tool_execution), reviewed execution regime
and preserved acceptance/scope. Repeated faults, architecture uncertainty,
scope changes and safety/identity faults are never eligible. There is no
subjective Root "remaining benefit" calculation. Research needs an explicit
frozen third-correction permission as well; it cannot exceed the hard cap.

## Requested, observed and disposition

Keep immutable requested and observed records per provider/model/effort,
profile, context, sandbox, permissions, Skills, MCPs, tools and continuation.

| Observation/event | Consequence |
| --- | --- |
| All dimensions proven equal | requested_match; ordinary verification/review |
| Only model/effort attribution missing | routing_metadata_unobservable; close further delegation; candidate may be validated once |
| Different model/effort with independently proven unchanged safety envelope | requested_mismatch; close delegation; candidate may be validated once |
| Missing/changed profile affects safety/context, unknown permissions, unproven confinement | Stop; no adoption based only on artifact checks |
| Wider grants, weaker isolation, unauthorized reads/writes | permission_scope_violation; stop and safe isolated recovery |
| Wrong context sources/freshness or worker identity | context_boundary_violation; stop and safe isolated recovery |
| Narrower-than-needed grant | Reject unusable execution contract; close routing; do not label it unauthorized escalation |

UNKNOWN is never MATCH. Before child start, actual confinement must already
enforce filesystem/data/tool/network/context restrictions independently of
requested model attribution. No post-hoc patch test proves safe access history.

Adoption dispositions accepted_under_unobservable or accepted_with_mismatch
do not replace observation fields. Either uses the single task-wide attribution
exception slot, requires Root verification and triggered review, and excludes
verified route-savings attribution. It does not remove costs/outcomes from the
benchmark's whole-policy cohort. Unknown safety has no adoption exception.

## Isolated baseline

Capture the materialized authorized input state, including dirty and relevant
untracked files, existence, file type, contents, mode, symlink target, dependency
versions and verification inputs. Record input and owned-path manifests.
Do not blindly copy secrets, .env files or unrelated untracked material.
Required but unavailable safe inputs make the task ineligible.

Worker writes only the isolated workspace, with owned files as its contractual
scope and independently enforced allowed reads/network/tools. A worktree by
itself does not enforce this. Compute a complete output-state diff to detect
new/deleted/untracked/mode/symlink and out-of-scope changes. Stop and reject
scope violations; do not salvage a patch invisibly.

Restore/discard only state owned by the attempt. Main-checkout bytes are never
restored to an older baseline. Preserve rejection evidence first, containing
only approved material. Uncertain ownership, leftover active processes or
unexpected external effects require explicit recovery state and Root judgment.

## Verification and final candidate

Root independently reads the complete diff, verifies scope and acceptance, and
reruns commands whose inputs changed. Reuse a pre-run result only if its full
declared dependency fingerprint is unchanged; when dependency coverage is
uncertain, rerun. Exit status alone is not acceptance.

Prepare the exact final integration candidate in isolation before review.
Worker completion is a claim. Root cannot repair a rejected patch and count
it as successful delegation: reject/restore or explicitly take over, account
for Root edits and obtain new verification/review evidence.

## Review packet and isolation

~~~text
ReviewPacket {
  main_task_id, candidate_id, producer: worker | root,
  original_user_instruction_refs[], root_intent_digest, acceptance_ids[],
  capsule_ref, full_diff_ref, final_candidate_manifest_digest,
  dependency_digest, verification_evidence[], risk_flags[], constraints[]
}
~~~

Original intent is an independent local reference, not only the capsule's
summary. No full Root conversation is copied. The reviewer can inspect
authorized context needed to judge both artifact and specification.

Persistent Interface/data-structure/security/permission changes or non-empty
judgment/gaps require review. The actual diff and Root facts govern; Jev cannot
downgrade the trigger. Fixed fresh gpt-6-astra / medium is a governance role,
not a worker-routing alternative. Check its actual configuration and freshness.
No descendants, implementation, worker contact or concurrent worker execution.

| Tier | Required evidence |
| --- | --- |
| ENFORCED_READ_ONLY | Observed read-only runtime plus effective tool/network confinement |
| BEHAVIORALLY_READ_ONLY | Hard read-only unnecessary/unavailable, trusted confinement remains, forbidden mutation and complete before/after state comparison |
| REVIEW_UNAVAILABLE | Unknown required evidence, insufficient required isolation or any mutation |

A read-only filesystem alone does not disable MCP/network writes. Tier 2 may
permit writes only inside a disposable review workspace, never shared/external
state; any detected mutation invalidates review and stops the lane.
ACCEPT / REVISE / RECONSIDER refer to one exact candidate/dependency snapshot.
Any later mutation voids the verdict.

## Publication and conflicts

Under an exclusive integration lease, verify all relevant shared input and
dependency digests still equal the captured baseline and final source matches
the reviewed manifest. A journal records expected before/after contents for
each write, deletion and mode change. Only the exact candidate is published.

The host must provide exclusion against all writers relevant to the publication;
a cooperative lock that an editor can bypass is not proof. If such a facility
is absent, prepare a patch and leave integration pending instead of claiming
atomic safe auto-apply. Multi-file writes need journaled recovery; recovery only
reverts bytes still equal to this transaction's writes. A third-party change
during recovery stops it and preserves both versions.

If shared dependencies or target state changed, stop automatic publication.
Root resolves conflicts in a fresh integration candidate, reruns affected checks
and obtains a new review when triggered. No automatic three-way merge. A mere
byte-identical transfer to an unchanged target is not a candidate mutation.
Do not run mutating formatters after review.

## Root fallback and acceptance

Root reuses local intent/capsule/evidence rather than redoing summaries. Its
implementation counts separately and respects original authorization and all
acceptance criteria. The same risk-triggered review applies. The protected
Root-review slot cannot be consumed by delegated candidates; after that review,
a required correction needs a new review, so delivery remains pending if no
slot remains. Do not silently waive the gate.

RECONSIDER closes delegation. Root resolves architecture itself; consult the
user only when intent or authorization is genuinely missing. Required review,
authorization or integration failure can leave the task pending. Cancellation
stops the work instead of creating a takeover. These are honest outcomes, not
a promise that any external dependency failure leaves completion unaffected.
