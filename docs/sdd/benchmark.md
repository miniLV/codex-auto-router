# Benchmark and qualification

The benchmark qualifies a complete routing/delivery policy. Model-share
migration and cheap-model substitution do not establish token savings.

## Arms and frozen experiment

A = pure frontier Root; B = same-session/JevRouter-style routing only when
reproducibly available; C = this full Jev policy. Record B unavailable rather
than fabricate it. Pair repository snapshots, user intents, acceptance checks,
environment and workload; randomize execution order and report cache regime.
Keep equivalent final acceptance and required review standards across arms.

Diagnostic ablations can isolate capsule, review, continuation and capability
effects. Ablations that remove a required safety/quality gate cannot qualify
production or stand in for C. Freeze corpus, risk/language/context strata,
sample size/power plan, margins, endpoints, missingness handling, rerun rules
and simultaneous-inference procedure before holdout. Publish losing strata.
No tuning question text, candidate construction or thresholds against holdout.

## Quality first

**Quality non-inferiority passes before any economics is evaluated.** Count
completion, blinded acceptance, critical regressions, security/Interface
defects, human intervention, restore and retry rates. Use preregistered
one-sided confidence procedures/margins appropriate to each endpoint, including
uncertainty for rare failures. No critical safety regression is compensable
by tokens. Missing outcome or insufficient statistical power does not pass.

Collect costs/tokens during runs; evaluating/selecting an economic winner
waits for quality. Do not exclude failed, denied, timed-out, pending or
Root-takeover assignments. Reviewer gates must not produce selection bias.

## Economic objective and missing data

For every Main Task compute, per model invocation, input and output tokens
(including Root intent/capsule construction, context rereads, Jev attempts,
discovery probes, workers, verification reasoning, reviews, retries, conflict
integration and Root takeover). Cached input is a subset of input; reasoning
is a subset of output where the provider defines it so. Zero-priced Jev
output is still output tokens and is still reported.

**Primary endpoints (only after quality passes):** preregistered one-sided
lower confidence bounds on paired reductions of (a) frozen-price-weighted
delivery cost — each arm's per-model token counts multiplied by price
weights frozen in the benchmark release — and (b) frontier-capacity
consumption (flagship input + reasoning tokens attributable to the Main
Task). Either endpoint may qualify a profile; both are always reported.
Weights live only in the frozen benchmark release; runtime routing and the
Guard never see prices. Raw total-token reduction is **not** required: a
cheap-token increase with weighted-cost or flagship reduction is success,
not failure. Total raw tokens, latency, retry/restore rates and model share
are secondary and reported.

Qualify only if quality passes and the preregistered bound holds for at least
one primary endpoint, including required stratum/multiple-comparison
corrections. A profile's scope must be supported by its evaluated population;
do not extrapolate tiny-edit wins to unknown work.

All assigned C tasks remain in intention-to-treat analysis. Missing model
attribution bars verified route-attribution claims but does not erase that
task's total usage or failure. Unknown provider usage is not zero. Use a
preregistered conservative bound, otherwise the profile cannot qualify.
Report missingness, coverage and attributable-only diagnostics separately.

Secondary metrics: total/flagship/cached/reasoning tokens, role overhead,
P50/P95 tokens and latency, retry/restore rates. Dollar savings or
subscription quota cannot substitute for a primary endpoint. Frozen
experimental budgets and price weights are conservative starting choices,
not proven optimal values.

## Research bootstrap

~~~text
ExperimentManifest {
  experiment_id, authorization_ref, purpose, fixture_set_digest,
  mode: research, production_qualification_waiver: true,
  contract_bindings, task_profiles[], candidate_template_digests[],
  frozen_confidence_floors, question_digest, sizing_evidence_ref,
  worker_cap: 2 | 3, third_correction_failure_classes[],
  quality_endpoints_and_margins, economic_endpoints, price_weights_digest,
  statistical_plan,
  missingness_and_exclusion_rules, retention_policy, expires_at
}
~~~

A user-authorized research run on approved isolated fixtures may waive only
existing economic qualification. Freeze the manifest before running it; all
egress, authorization, permissions, baseline, review, actual host proof and
hard counters still apply. A three-worker experiment must explicitly permit
the third correction; absent permission retains cap two. No runtime can
self-declare research to bypass Guard. Research output is not production
qualification; an independently checked report produces that artifact later.

## Production qualification Interface

The eventual artifact lives at docs/benchmarks/qualification.json. Do not
create a passing example file before evidence. Define and validate its schema
in P1, not after Guard implementation.

~~~text
QualificationArtifact {
  schema_revision, artifact_id, evidence_report_digest, issued_at,
  experiment_id, holdout_fixture_digest, statistical_plan_digest,
  bindings: {
    contract_revision, projection_rule_digest, question_digest,
    candidate_construction_digest, provider_model: jev-1.13.0,
    sizing_method_digest, host_contract_id, execution_template_digests[],
    review_template_digest, verification_regime_digest,
    transport_policy_digest, language_regime, attempt_regime_digest
  },
  profiles: [{
    profile_id, observable_predicate,
    supported_candidate_families, confidence_floor_by_review_class,
    quality_result: { endpoints, estimates, intervals, margins, passed },
    economic_result: { weighted_cost_margin, flagship_consumption_margin,
                       lower_bounds, coverage, passed },
    automatic_routing_allowed,
    max_worker_executions: 2 | 3,
    third_correction: { allowed, failure_classes[], evidence_report_ref }
  }]
}
~~~

Predicates use measured attributes such as authorized effect class, review
class, context-size bucket and host features. They are versioned, disjoint
and validated for overlap. No Root-selected favorable label, ambiguous
semantic task classifier or profile chosen by Jev. Missing/unknown/overlapping
profile means no production delegation. Profile matching permits or denies;
it does not select a model.

Bind host semantic grants/configuration and templates, not changing timestamps,
opaque task IDs or task-specific path strings. A fresh observation does not
invalidate evidence; a changed model/question/permission/review/budget regime
does. Candidate families must match evaluated coverage; adding an untested
model changes the family, not silently extends qualification.

Frozen evidence may annotate candidates with empirical token-efficiency classes
and uncertainty for Jev; no live per-task numeric savings forecast. Guard
checks bindings and verdicts, never tunes confidence or ranks candidate models.
Qualification for ordinary routing does not imply third-correction qualification.
Receipts may feed an explicitly authorized offline benchmark; they never feed
an adaptive online route controller.

## Claims

Report the full population, uncertainty, cache regime, losing strata and
attribution coverage. Single-pair A/B differences are exploratory. Freeze and
evaluate a new regime before updating qualification. Product claims follow
spec.md §16, not upstream routing-accuracy benchmarks.
