# JevAdapter

One deep Module hides provider serialization, response parsing and transport
behind the Interface route(RouteRequest, FrozenSelectionPolicy, AbortSignal)
-> RoutePlan | RoutingFailure. It does not discover capabilities, execute
native tools, grant permissions or choose a replacement route.

## Request and normalization

Send only the validated RoutingProjection and safe complete-candidate summaries
to POST https://api.typesafe.ai/v1/systemone, model jev-1.13.0. One request has
exactly one question: route, of type Choice, with a criterion for every
candidate ID including root. Use the frozen instruction/description template
from [RoutePlan](route-plan.md); hash its exact serialized form.

There is one semantic call per decision. No Score or Noul in v1: an independently
evaluated question cannot assess the output of a sibling question, and
probabilistic authorization is not an enforcement mechanism. Future additional
signals need a new experiment and qualification; they are not implemented
as dormant configuration.

Validate the response against the exact requested question/options/model.
Return the exact chosen candidate unchanged. Preserve provider-native confidence,
probabilities and usage; risk, benefit and reason annotations have the explicit
local provenance defined in route-plan.md. Adapter never synthesizes a model,
effort, profile or tool selection.

Guard owns the frozen confidence floor, bound to question/candidate construction,
Jev version, task profile and risk regime. Adapter uses the supplied value to
return LOW_CONFIDENCE; Guard rechecks the same value. No duplicated default,
per-task tuning or derived confidence class. Missing selection policy blocks
the call. Confidence measures distribution concentration, not correctness.

## Size preflight

| Constraint | Contract ceiling |
| --- | --- |
| Choice options, including root | 255 options |
| State plus all questions | 64,000 provider tokens |
| State plus longest single question | 32,000 provider tokens |

V1 has one question, so state plus that question must fit 32,000. These are
token ceilings, not character/byte limits. Candidate labels have no invented
255-byte restriction. Count the actual serialized state, instructions and
criteria with a pinned provider-compatible tokenizer, or a conservative bound
validated for that pinned tokenizer/packing format. Record sizing_method and
its evidence/version. A generic OpenAI tokenizer or bytes/4 estimate does not
prove a Jev bound. No supported sizing method is currently asserted by this
design: proving one is an explicit P2 readiness task; UNKNOWN returns
INPUT_UNSUPPORTED/SIZING_UNPROVEN without a provider call.

Projection construction omits only fields excluded by its fixed rule before
sizing. Never trim the option list, acceptance criteria, risks or failure
evidence in response to an overflow. Oversize returns INPUT_UNSUPPORTED;
lifecycle takes Root. A future hierarchical Jev selector requires its own
design and qualification, not an Adapter workaround.

## Transport policy

Operational defaults are frozen with the experiment/qualification:

- Overall wall-clock deadline: 20,000 ms, including backoff and parsing.
- At most two HTTP attempts; each at most min(10,000 ms, remaining deadline).
- Adapter is the single retry owner; disable SDK and HTTP-client hidden retries.
- Retry once for network/transport failure, timeout, 429, 529, or 500/502/503/504.
  A transport retry resends the identical semantic request; it is not resampling
  a valid answer. Record the possibility of duplicate provider processing.
- Parse Retry-After delta-seconds or HTTP-date. Never retry before its delay;
  if it leaves less than 1,000 ms for the next attempt, return UNAVAILABLE.
  Without the header, use 250–500 ms jitter subject to the same deadline.
- Do not retry 400/401/403/404/413/422, other non-retryable responses, schema
  failure, drift or low confidence. A malformed Retry-After is ignored in favor
  of bounded default backoff and recorded.
- AbortSignal disarms the decision before canceling transport. Late or duplicate
  responses cannot create a plan/execution. No response from a closed decision
  is acted on. Cancellation does not trigger Root execution.
- Record every HTTP attempt and usage. Failed responses without usage are
  UNKNOWN; never claim a timed-out call cost zero.

No request-rate constants are used for scheduling; official rate limits can
change. Deadline management is a transport constraint, not a model selector.

## Pinning, credentials and failure mapping

Pin jev-1.13.0 in every request and validate every returned model ID. Do not use
jev-latest/jev-preview or require their startup resolution when sending a pinned
ID. A retirement or change requires explicit requalification, not silent upgrade.

Credentials are read by transport only, never copied into state, logs, error
bodies or receipts. Use an approved HTTPS origin; disable cross-origin redirects.
An environment base-URL override must not silently redirect credentials or
task data; another endpoint requires an explicit matching egress policy.
Missing authentication returns UNAVAILABLE/AUTH_UNCONFIGURED.

| Event | Failure |
| --- | --- |
| Network, timeout, exhausted retryable status | UNAVAILABLE with transport subreason |
| Authentication/configuration/non-retryable HTTP error | UNAVAILABLE with sanitized non-retryable subreason |
| Invalid body, option/question mismatch, numeric invalidity, model drift | MALFORMED |
| Valid selected answer below the supplied Guard floor | LOW_CONFIDENCE with selection evidence |
| Unsafe data policy/projection | UNSAFE_PROJECTION before HTTP |
| Oversize, unsupported input or unknown sizing | INPUT_UNSUPPORTED before HTTP |
| User/runtime cancellation | CANCELLED |

Return typed results even for parse, configuration and token-sizing exceptions.
Provider bodies must not escape through generic thrown errors. All failures
other than cancellation close automatic routing to Root responsibility; the
adapter itself never emits a fallback plan. The receipt keeps sanitized
selection/usage evidence rather than unbounded raw response or error strings.
