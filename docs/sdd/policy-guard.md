# Policy Guard

Pure deterministic Interface: validate(RoutePlan, GuardContext)
-> ALLOW(the_same_plan) | DENY(stable_reason_code). The returned plan must be
identical to the selected candidate. **Jev chooses. The Guard validates. Codex
executes. Root verifies.** Lifecycle, not Guard, implements fixed Root fallback.

## Preflight and validation

The same predicates support preflight before Jev and final validation after
selection. Preflight can avoid unnecessary calls when no delegate is eligible.
It does not choose an alternative worker or invoke a hidden router.

| # | Check | Failure examples |
| --- | --- | --- |
| 1 | Valid discriminated schema; request/capsule/candidate/host binding; decision OPEN and response unused | INVALID_PLAN, STALE_DECISION |
| 2 | Provider confidence meets the one frozen selection policy for this profile/risk/question regime | LOW_CONFIDENCE, MISSING_SELECTION_POLICY |
| 3 | All capabilities selectable with OBSERVED, unexpired matching evidence | CAPABILITY_UNKNOWN, CATALOG_CHANGED |
| 4 | Complete provider/model/effort/profile combination matches effective host precedence and template | INCOMPATIBLE_CONFIGURATION |
| 5 | Context mode and authorized context sources are enforceable | CONTEXT_UNPROVEN |
| 6 | Owned paths resolve canonically, are bounded and non-overlapping; all acceptance IDs preserved | INVALID_OWNERSHIP, ACCEPTANCE_WEAKENED |
| 7 | Local authorization and approved egress policy cover this exact operation and projection | UNAUTHORIZED, UNSAFE_PROJECTION |
| 8 | Concrete verification has actual Root pre-run evidence and valid dependency bindings | VERIFICATION_MISSING |
| 9 | Complete isolated baseline, ownership manifest and recoverable integration mechanism exist | BASELINE_UNSAFE |
| 10 | Entire effective permission/tool/Skill/MCP set is explicit, confined and sufficient; enforcement proven before child starts | PERMISSION_UNPROVEN, EXCESS_GRANT |
| 11 | No delegated external mutation, publication, messaging, shared-checkout write or secret access | FORBIDDEN_EFFECT |
| 12 | No descendants or concurrent child work, enforced by host grants | FANOUT_FORBIDDEN |
| 13 | Exact production qualification binding, or valid explicit frozen research permit | PROFILE_UNQUALIFIED, BINDING_CHANGED |
| 14 | Main Task decision/HTTP/worker budgets and qualified third-correction conditions permit this attempt | EXECUTION_BUDGET, THIRD_NOT_QUALIFIED |
| 15 | Delegated review slot when required, reviewer readiness, and protected Root-final review slot remain | REVIEW_UNAVAILABLE, REVIEW_BUDGET |
| 16 | Continuation handle, worker identity, unchanged ownership/configuration and restored context all revalidated | CONTINUATION_UNPROVEN |

RootPlan validates common identity, authorization, confidence and data rules;
delegate-only configuration/baseline/worker-budget checks are not fabricated
requirements for it. Its execution still follows Root acceptance/review rules.
A preflight lifecycle Root fallback is not a Guard-approved child plan.

Candidate construction may evaluate checks 3–13 to exclude inadmissible options,
but must preserve every eligible option and each exclusion reason. Guard runs
the checks again on the chosen configuration and current evidence. Any change
closes routing, even if another option would pass.

## Least privilege and unknowns

"Least privilege" means grants are subsets of explicitly authorized reads,
owned isolated writes and allowed read-only network origins, with only the
declared tools and no descendants or external mutations. It is a set-containment
and enforcement predicate, not a model's judgment about permissions.

Unknown safety evidence is DENY; requesting restrictions does not prove them.
Attribution-only unknown model/effort after a safe execution is handled by the
lifecycle matrix, not used as permission to start an unconfined worker.
Do not trust worker-reported runtime settings.

## Qualification and confidence

Qualification predicates, confidence floors and all semantic bindings are
frozen in a release's evidence artifact or research manifest. No account,
Dashboard, ccusage, model share, credit or latency feedback is read. Jev risk
opinions cannot lower deterministic review or permission requirements.
The Guard never estimates token benefit at runtime.

## DENY is terminal for automatic routing

DENY returns a reason, not an alternate RoutePlan. Lifecycle closes automatic
routing for **the task unit that was denied**. Root may complete authorized
work or resolve intent; it may not repair the request and ask Jev again for
that closed unit. Sibling units of an OPEN Main Task keep their routing. No
automatic re-route is triggered by denial classes. Only a recoverable
worker failure before unit closure can create another semantic Jev decision.
