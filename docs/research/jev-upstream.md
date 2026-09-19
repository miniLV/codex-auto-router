# Upstream research: TypeSafe Jev

Evidence report — not normative. All facts below are OFFICIAL unless marked
otherwise: fetched from <https://docs.typesafe.ai> and the TypeSafe blog on
2026-09-19.

## Record

| Field | Value |
| --- | --- |
| Product | Jev — TypeSafe's flagship "System One" decision model |
| Endpoint | `POST https://api.typesafe.ai/v1/systemone` |
| Models | `jev-1.13.0` current; aliases `jev-latest`, `jev-preview`; JevRouter observed `typesafe/jev-1.13-20260917` naming |
| Pricing | Input $42 / Btok ($0.042 / Mtok); output tokens free |
| Rate limits | 250,000 tokens/s; 1,200 requests/min; over-limit → 429 with `retry-after`; `529 Overloaded` also retried with backoff. TypeSafe warns limits are **adjusting dynamically** — never hard-code them (verified 2026-09-19) |
| Training | RLCD (Reinforcement Learning for Calibrated Decisions); no per-account fine-tuning |

## The API shape (OFFICIAL)

Request:

```json
{
  "state": <string | JSON object | array of text values>,
  "model": "jev-latest",
  "questions": {
    "<id>": { "type": "choice", "instructions": "...", "criteria": { "<option>": "<description>" } },
    "<id>": { "type": "score",  "instructions": "...", "criteria": ["low", "medium", "high"] },
    "<id>": { "type": "noul",   "instructions": "..." }
  }
}
```

Response: `answers.<id>` with `choice` + `probabilities` (sum to 1) +
`confidence` (Choice); `score` + `probabilities` + `confidence` (Score); `noul`
in 0–1 (Noul); plus `usage: {input_tokens, output_tokens}`.

Key properties (OFFICIAL):

- **Text-only input.** No image/audio/video. `state` budget: 64k tokens covers
  state + all questions; 32k covers state + the longest single question.
- **No generated text.** Jev cannot hallucinate prose; it returns typed answers.
  This makes it a good routing brain — but it also means it can never *explain*
  or *specify*; the Task Capsule must be authored by Root.
- **Calibrated probabilities**, not per-answer guarantees; calibration is
  measured across groups of predictions.
- **Parallel evaluation**: questions in one call are evaluated independently in
  isolation against the same state; adding questions barely changes latency.
- **English is the primary training language**; other languages work but score
  lower accuracy. English state is the safer default.
- **A Choice accepts up to 255 options.**
- SDKs exist (Python documented; TS available). `TYPESAFE_API_KEY` env var;
  `TYPESAFE_BASE_URL` override; retry policies with backoff.

## Mapping to our components

| Our component | Jev mechanism |
| --- | --- |
| RoutePlan `decision` (root vs delegate) + capability selection | Choice over candidate capabilities / execution modes |
| `confidence` gate in the Policy Guard | Choice `confidence` + option `probabilities` |
| Risk/benefit classes | Score criteria or Noul flags (e.g., `is_bounded_write`) |
| Authorization-fit, risk flags | Noul (0–1 truth score) |
| RouteRequest serialization | `state` (structured JSON object; text-serializable) |
| Correction strategy (continue vs fresh vs takeover) | Choice over continuation modes with failure evidence in `state` |
| Decision Receipt | Full provider response retained (probabilities, confidence, usage) |

## Failure semantics to implement in the JevAdapter

From OFFICIAL API behavior plus the upstream JevRouter's adapter conventions:

- timeout / network error → adapter returns `UNAVAILABLE` (never a route).
- malformed / schema-invalid response → `MALFORMED`.
- confidence below the Guard's frozen floor → `LOW_CONFIDENCE`.
- model alias drift (`jev-latest` → new major) → pin an explicit version and
  validate; treat unexpected model ids as `MALFORMED` for Guard purposes.
- all of the above resolve to **Root execution**; none may invent a fallback
  route (the canonical failure flow).

## What Jev cannot do (and therefore never does here)

- Write code, write the Task Capsule, or specify work (no text generation).
- Verify artifacts or run commands.
- Execute anything by itself — it is decision-only.
- Guarantee "the optimal model" (calibrated probabilities ≠ guarantees) — this
  is why the product claims discipline (`spec.md` §16) forbids claiming "Jev guarantees the optimal model"
  before benchmark qualification.

## Cost model implication for the benchmark

Output tokens are free and input is $0.042/Mtok. Jev routing calls are orders
of magnitude cheaper than frontier execution tokens; the realistic overhead to
measure is the *capsule serialization cost at the frontier* (building and
sending the RouteRequest) and Root's verification overhead, not the Jev call
itself. The benchmark must still count all of it (`spec.md` §15).
