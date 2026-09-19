# Upstream research: JevRouter

Evidence report — not normative. The normative contract lives in `spec.md` and
`docs/sdd/`.

## Record

| Field | Value |
| --- | --- |
| URL | <https://github.com/BillionsBobby/JevRouter> |
| Commit/tag | `main` HEAD inspected 2026-09-19 (36 commits, branch `main`) |
| License | MIT (`LICENSE` at repo root) |
| Language | TypeScript, Node ≥ 20 |
| Evidence classes used below | OBSERVED = repo README/docs fetched directly; CLAIMED = numbers stated by the upstream repo without independent reproduction; UNKNOWN = not verifiable from this inspection |

## What it actually is

A lightweight router that puts the TypeSafe Jev System One decision model in
front of a set of agent capabilities: models, subagents, Skills, MCP tools,
CLIs, and DSH plugins. Jev answers one typed Choice question; JevRouter owns
availability, permissions, risk, and confirmation.

The upstream's own split is instructive and matches this redesign:

> Jev owns the decision probabilities; JevRouter owns availability, permissions,
> risk and confirmation.

## Architecture (OBSERVED)

- Surfaces: CLI (`route`, `plan`, `discover`, `serve`, `agent`), SDK
  (`route()`, `plan()`), HTTP (`POST /route`), MCP stdio (`serve-mcp`, one
  `jev_route` tool that never executes implicitly).
- One call = one Jev Choice over a candidate manifest set. Multi-step `plan`
  supports serial, batch, and decompose strategies with beam sequence search.
- Manifest contract per candidate: `id`, `name`, `type`, `description`,
  `input_schema`, `permissions`, `risk`, `availability`, `execution`,
  `policy.requires_confirmation`. This is functionally what this project now
  calls a **Capability Catalog**.
- Discovery: Skill frontmatter, MCP `initialize`+`tools/list`, CLI `--help`,
  DSH manifests.
- Decision-only by default: nothing executes implicitly; medium/high/critical
  risk requires confirmation; risk/permission/availability are hard filters.
- When Jev picks a filtered candidate, router may substitute the
  highest-probability *safe* candidate but records that in `fallback.reason` and
  keeps `jev_choice` unchanged.
- Receipts: append-only decision/plan files in `.jevrouter/plans/` with
  provenance hashes (`candidate_snapshot_hash`).
- `require_verified_candidates` option makes unverified candidate descriptions
  ineligible.

## Failure semantics (OBSERVED)

- Exit codes: 0 = selected, 2 = review/no-decision, 1 = error.
- Below confidence floor → `no_decision`, `selected: null`.
- Cache off by default for CLI; SDK caching opt-in.

## Routing strategy (OBSERVED)

- Jev returns `choice`, per-option `probabilities`, `confidence`.
- Fallback is *selection-time filtering*, not model rerouting: the router never
  picks a different capability other than the highest-probability safe one, and
  always records when it did.

## Review / isolation / verification model

- None. JevRouter routes decisions; it does not execute tasks, does not verify
  artifacts, does not perform parent verification, fresh review, or restore.
  This is the largest gap this product fills (CLAIMED only via its benchmark
  being "ordered routing decisions, not end-to-end task completion").

## Benchmark claims (CLAIMED)

- First-5 tool-call prediction on 10 Toolathlon tasks: Jev serial 38% →
  decompose+thread 44% position-wise hits vs DeepSeek V4.1 Flash 24%;
  1.58s/task latency; ~$0.006 per 10 tasks. MCP-Atlas: 44% hits / 69% overlap.
- Explicitly labeled as measuring ordered routing decisions, not end-to-end
  task completion. That honesty is worth copying; the numbers themselves are
  not evidence for our product claims.

## Copied into the new architecture

1. **Jev as sole routing brain** with a separate deterministic layer owning
   availability/permissions/risk (becomes our Policy Guard).
2. **Capability manifests as the routing substrate** (becomes the Runtime
   Capability Catalog).
3. **Decision receipts with provenance hashes** (becomes the Decision Receipt).
4. **Decision-only default + confirmation gates for risky routes.**
5. **`no_decision` below a confidence floor, distinct from error.**
6. **Candidate-snapshot hashing** so routing reproducibility can be audited.
7. **Honest benchmark scoping** (routing accuracy ≠ end-to-end delivery value).

## Intentionally NOT copied

- Generic multi-provider surface (OpenRouter as an alternative Jev). Our
  product is Jev-native; the single adapter targets the official TypeSafe API.
- Tool routing for CLI/MCP/DSH plugin candidates as v1 scope. We route
  model/effort/agent/context first, expand later.
- `fallback.reason` silent substitution of the highest-probability safe
  candidate. In our system the Guard's only fallback is Root takeover; silent
  capability substitution is forbidden.
- Append-only on-disk receipt persistence by default for normal (ephemeral)
  routing. We persist only in benchmark/research mode.
- JevRouter's Star/market positioning. Claims discipline against our own
  `spec.md` §16 claims discipline.

## Open questions

- Jev model id/pinning strategy for `jev-1.13.0` vs `jev-latest` alias drift.
- Rate limits (250k tok/s, 1200 rpm) are generous but unverified against our
  capsule sizes at 64k context budget.
- Whether Jev confidence calibrated against Toolathlon transfers to code-task
  routing (UNKNOWN; drives benchmark §16).
