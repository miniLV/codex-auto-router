# Architecture acceptance cases

These cases are the implementation handoff, not assertions that runtime code
already exists. Test public Module Interfaces with deterministic fixtures,
then prove the host-dependent cases with actual read-only/isolated invocation.
Never replace a behavioral case with a prose-presence regex.

| ID | Required case | Phase |
| --- | --- | --- |
| A01 | RootPlan has no child fields; delegate has every resolved field; missing scope arrays fail and empty arrays grant nothing | P1 |
| A02 | Same Choice ID maps to exactly one complete candidate; adapter cannot fill/substitute fields; root remains selectable | P1/P2 |
| A03 | Incompatible agent/model/effort/provider or inherited grant is excluded and independently denied by Guard | P1/P3 |
| A04 | Raw capsule secret, credential, tool output or injected instruction never becomes provider state/criteria authority; unsafe projection makes zero HTTP calls | P1/P2 |
| A05 | Correction preserves all acceptance IDs; narrowing work cannot erase a requirement | P1/P4 |
| A06 | OBSERVED selectability does not produce requested_match; UNKNOWN safety fails before first child instruction | P1/P3 |
| A07 | Safe attribution unknown/mismatch can be adopted once with required checks, preserves raw state and closes all later delegation | P1/P4 |
| A08 | Same Main Task across units/resume retains all counters; unit closure never starves sibling units; start ambiguity consumes a worker slot and cannot duplicate dispatch | P1/P3 |
| A09 | Second execution failure can reach a third only with exact correction qualification/permit and fresh Jev decision; repeated fault always stops | P1/P4 |
| A10 | DENY, Jev root, cancellation and takeover close the current task unit; only the enumerated latch events (safety/permission violation, lost state/counter corruption, competing router, authorization ambiguity, global budget exhaustion, host trust invalidation) close the Main Task; new labels/revisions cannot reopen either layer | P1/P4 |
| A11 | Cancellation prevents late HTTP/native responses from spawning work; cleanup does not execute the user task in Root | P2/P3 |
| A12 | 255 options accepted, 256 closes without truncation; exact 32k/64k token rules and unknown sizing handled without byte estimates | P2 |
| A13 | One question only; finite full distribution validated; wrong option/model/answer IDs, invalid sum, malformed and low confidence never resample | P2 |
| A14 | SDK retries disabled; retryable statuses honor one total deadline/Retry-After; 401/403/drift terminal; failed usage stays UNKNOWN | P2 |
| A15 | Profile file/tool schema presence cannot prove applied grants; changed fingerprint invalidates cached selectability without paid probes per tuple | P3 |
| A16 | Actual native invocation and trusted pre-execution safety evidence are demonstrated; Node-only simulated spawn never counts as runtime proof | P3 |
| A17 | Isolated baseline includes authorized dirty/untracked/type/mode/symlink state; escaping symlinks and out-of-scope output rejected | P4 |
| A18 | Failed worker restores only its workspace; concurrent shared-checkout edits survive unchanged | P4 |
| A19 | Review packet includes original intent independent of capsule; omission of a requirement can be detected | P4 |
| A20 | Actual diff triggers review; correct worker prose cannot suppress it; Root takeover uses the same rule | P4 |
| A21 | Three delegated reviews cannot consume the protected Root review; unavailable/exhausted required review yields pending, not accepted | P4 |
| A22 | Reviewer mutation/wrong context voids result; behavioral tier never claims enforced read-only | P4 |
| A23 | Post-review mutation/dependency change invalidates evidence; conflict publication stops; no automatic merge or overwrite | P4 |
| A24 | Journaled publication/recovery checks ownership and expected bytes; unavailable exclusive host publication remains pending | P4 |
| A25 | Research permit bypasses only prior economics; absent/wrong permit cannot bypass any safety or hard budget | P1/P6 |
| A26 | Disjoint observable profile match; unknown/overlap/binding drift blocks production; third permission separate | P1/P6 |
| A27 | All C assignments, failures and takeover costs retained; missing usage cannot improve savings; cached/reasoning subsets not double-counted | P6 |
| A28 | Quality gate passes before token inference; flagship-share or dollar improvement alone cannot qualify | P6 |
| A29 | Failure receipt has no fake plan/usage; replay needs sanitized fixtures beyond digests; live repeat not promised identical | P1/P6 |
| A30 | Dashboard/receipts/account state never drives selection; typed current failure evidence may support a bounded correction | P1/P6 |
| A31 | task_traits are computed deterministically from capsule facts by a versioned rule; a projection containing route-directed vocabulary (difficulty, recommended model/lane, cheap/expensive, simple/complex, delegate/root suggestion, strong/weak model) is UNSAFE_PROJECTION with zero HTTP calls | P1/P2 |
| A32 | Benchmark primary endpoints are weighted-cost and flagship-consumption reductions; a run with more raw total tokens but lower weighted cost and flagship consumption qualifies economics (after quality); runtime/Guard never read prices | P6 |
| A33 | `delegated_write` executions are unconstructible until baseline, isolation, restore, verification, review and publication all exist; P3 `probe_read_only` cannot produce a writable child | P1/P3/P4 |

## Existing static-test migration

The current suite has 51 tests, including 28 in test/policy.test.ts. Preserve
useful metadata, installer, identity and observer checks. Rework prose-only
policy assertions into the cases above as the runtime lands.

The identity-count test currently uses a non-global regular expression with
String.match(...).length. Four occurrences returned one in the architecture
review. Replace that count with matchAll or an equivalent global count, and
assert approved historical locations/context rather than blanket file
exemptions. The task document legitimately contains multiple migration
references; define the expected allowance from actual intent, not a broken
constant. No test/source change is part of this Markdown-only revision.

## Review-finding closure map

| Finding | Normative owner / implementation proof |
| --- | --- |
| F1 External secrets and injection | task-capsule.md; A04 |
| F2 Complete Choice / independent questions | route-plan.md, jev-adapter.md; A01–A02, A13 |
| F3 Effective compatibility and inheritance | capability-catalog.md, policy-guard.md; A03 |
| F4 Unknown safety versus attribution | delivery-lifecycle.md; A06–A07 |
| F5 DENY, counters and qualified third attempt | delivery-lifecycle.md; A08–A11 |
| F6 Concurrent restore safety | delivery-lifecycle.md; A17–A18, A23–A24 |
| F7 Independent review and fallback acceptance | delivery-lifecycle.md; A19–A22 |
| F8 Qualification bootstrap and bindings | benchmark.md; A25–A26 |
| F9 Limits, pinning, deadlines and retries | jev-adapter.md; A12–A14 |
| F10 Whole-policy token economics | benchmark.md; A27–A28 |
| F11 Receipts and replay | decision-receipt.md; A29–A30 |
| F12 Stale references and misleading static checks | This migration section; link/terminology checks |
| F13 Concrete native host Seam | architecture.md; A15–A16 |

README, installation copy and image findings are explicitly outside this
architecture revision and remain productization work.
