# JevAdapter

The single seam between this repository and the TypeSafe Jev API. Jev's wire
schema appears in exactly one place.

## Boundary

```text
internal RouteRequest (typed)
        ↓
JevAdapter
        ↓  POST https://api.typesafe.ai/v1/systemone
normalized RoutePlan (typed) | RoutingFailure(reason)
```

## Responsibilities

1. Serialize the internal RouteRequest into a Jev `state` (text/JSON object;
   English preferred — Jev's primary training language) plus typed questions:
   - `route`: **Choice** over execution modes and candidate capabilities
     (`root`, delegate options from the catalog);
   - `risk_class`: **Score** over frozen risk criteria;
   - `authorization_fit`: **Noul** (does the plan fit the authorization
     boundary?);
   - `bounded_scope`: **Noul** (is the requested scope bounded as claimed?).
2. Normalize the response into the internal RoutePlan, carrying `confidence`,
   per-option `probabilities`, `risk`, `benefit_class`, and `reason_codes`.
3. Map provider failures to RoutingFailure states: `UNAVAILABLE` (timeout,
   network, 429/5xx), `MALFORMED` (schema-invalid, unexpected model id),
   `LOW_CONFIDENCE` (below the Guard's frozen floor). Never invent a route.
4. Enforce timeouts and retry limits (backoff honoring `retry-after`); SDK
   retry policy applies, but no silent retry storm: bounded attempts.
5. Retain the raw response (probabilities, confidence, `usage`) for the
   Decision Receipt.

## Non-responsibilities

- No capability discovery (that is the catalog).
- No validation (that is the Guard).
- No execution (Codex runtime).
- No cost/token forecasting: Jev returns calibrated classes/probabilities; the
  adapter forwards them verbatim and never converts them into dollar/token
  predictions (`spec.md` §6 rules).

## Pinning and evolution

- The adapter pins an explicit Jev model id (currently the `jev-1.13.0`
  generation); `jev-latest` alias drift is validated at startup and unexpected
  ids map to `MALFORMED`.
- API evolution is absorbed *only* here. New request/response fields may be
  added at the adapter; no other file may depend on Jev's wire schema.

## Failure semantics

Every adapter failure state resolves to **Root execution** — automatic
delegation unavailable. There is no adapter-level fallback route; the Guard
decides nothing on the adapter's behalf and Root never inherits an
auto-selected alternate from a failed call.
