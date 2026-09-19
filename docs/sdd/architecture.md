# Architecture

## Five roles

```text
User
  → Frontier Root            supervisor / architect / verifier
  → Jev                      routing brain (sole automatic selector)
  → JevAdapter               the only seam to the TypeSafe Jev API
  → Policy Guard             deterministic validator (veto, no alternates)
  → Codex native runtime     executor substrate
  → Root verification        mechanical, then fresh review when triggered
  → Root final acceptance    deliver
```

### A. Frontier Root

Root owns requirements, ambiguity resolution, architecture, decomposition,
task-unit definition, success criteria, user interaction, final verification
judgment, final acceptance, and external irreversible actions.

Root is **not** a router. Root contains no heuristic such as
"single-file → Luna, multi-file → Terra". Root authoring the Task Capsule and
judging results is its job; choosing *who* executes is Jev's.

### B. Jev — routing brain

Jev is a **strategic core dependency**, not an optional advisor, second
opinion, diagnostic, or experiment. It may select:

- root execution or delegated execution;
- model, reasoning effort, agent/profile;
- Skill set, MCP set, tool scope;
- context strategy (fresh vs continuation);
- continuation strategy after failure (takeover / continue / fresh / reroute).

### C. JevAdapter

`internal RouteRequest → JevAdapter → TypeSafe Jev API → normalized RoutePlan`.
One adapter file boundary. It exists to isolate Jev API evolution, SDK/CLI
changes, schema changes, response normalization, and timeout/error handling.
It is **not** a multi-provider abstraction; Jev is the only provider
(deliberately — see `spec.md` §19 non-goals).

### D. Policy Guard

Deterministic. Validates the RoutePlan against the catalog, authorization,
ownership, verification, baseline, least-privilege, budget, and profile
qualification. Returns exactly `ALLOW(RoutePlan)` or `DENY(reason) → Root`.
It never says "Jev chose A but I choose B".

### E. Codex native runtime

Native agent spawn with per-spawn model/effort override, Skills, MCPs, tool
permission surfaces, sandbox modes, and continuation surfaces where verifiably
supported (first stable slice — see `spec.md` §18.7). No parallel generic agent runtime unless
Codex lacks a required primitive and the gap is demonstrated.

## Canonical flow

1. Root decomposes and authors a **Task Capsule** (bounded, not the whole
   conversation).
2. Root builds the **Runtime Capability Catalog** of what is actually available
   now.
3. Catalog + capsule + attempt state → **RouteRequest**.
4. JevAdapter calls Jev; Jev returns a typed decision → **RoutePlan**.
5. **Policy Guard** validates: `ALLOW` or `DENY → Root`.
6. Codex native execution of the accepted plan; requested-vs-observed contract
   recorded.
7. Worker result → **Root mechanical verification** (diff, scope, rerun).
8. **Fresh independent semantic review** when triggered (isolation tier
   observed, never assumed).
9. **Root final acceptance** or restore/takeover. Deliver.

## Failure flow

| Trigger | Resolution |
| --- | --- |
| Jev timeout / unavailable / malformed / low-confidence | Automatic delegation unavailable → Root executes |
| Guard `DENY` | Root executes (never an alternate route) |
| Execution contract violation (weaker/unauthorized scope) | Restore when necessary → Root takeover |
| Worker failure (verifiable but wrong) | Restore → correction only if budget permits → else Root takeover |
| Reviewer `RECONSIDER` | Return to Root architecture/judgment; never blindly retry workers |
| Reviewer mutation / state change | Verdict voided; Tier 3 review-unavailable; stop the lane |

## Depth model

- One active delegated child at a time. Reviewer and worker never run
  concurrently. No child may delegate (no fan-out).
- Depth is measured in **executions**, not dispatch labels: hard ceiling 3
  worker executions per Main Task; automatic economic ceiling 2; a third
  execution requires explicit benchmark qualification for that task profile.

## Authority and coexistence

Exactly one automatic selector (Jev). If a competing routing authority (a
same-session router, proxy router, another auto-router skill) governs the
current Main Task, the Auto Router stands down to `ROOT_DIRECT`. Decision
receipts and dashboards are evidence, never routing authority. Quota, account
state, ccusage, model mix, and latency are never routing inputs.
