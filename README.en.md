<h1 align="center">Jev Auto Router</h1>
<p align="center">
  <img src="assets/auto-router-cover.png" alt="Jev Auto Router plugin cover" width="420">
</p>
<p align="center">
  <strong>Jev chooses the route, the Policy Guard validates it, Codex executes it, and Root verifies and accepts. Every Main Task passes the routing gate once, and the whole delivery is recoverable and auditable.</strong>
</p>

<p align="center">
  A Jev-native, Codex-native capability-routed delivery workflow. You bring the goal and constraints; Root (<code>gpt-6-astra</code> or <code>gpt-5.6-sol</code>) owns requirements, architecture, decomposition, and acceptance; Jev is the sole automatic routing brain.
</p>

<p align="center">
  <a href="https://github.com/miniLV/jev-auto-router">GitHub</a> ·
  <a href="README.md">简体中文</a> · <strong>English</strong>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#routes"><strong>Routes</strong></a> ·
  <a href="#reading-the-payoff"><strong>Reading the payoff</strong></a> ·
  <a href="#updating"><strong>Updating</strong></a>
</p>

> This project was renamed from `codex-auto-router` (see the architectural
> reset in [ADR 0013](docs/adr/0013-jev-native-routing-architecture.md)); the
> repository now lives at `miniLV/jev-auto-router`.

## Quick start

You need a current Codex CLI with plugins enabled, GPT-6 Astra or GPT-5.6 Sol
at Medium or higher for the primary session (confirmed from trusted
current-task runtime metadata), and the native `spawn_agent` surface. Model
and lane access is needed only when the selected route delegates. **No `jq`
and no companion roles to install** — model, effort, and fresh context are
supplied per spawn as `spawn_agent` parameters.

```sh
codex plugin marketplace add miniLV/jev-auto-router --ref main
codex plugin add jev-auto-router@jev-auto-router
```

This marketplace follows `main` so users receive the current version. Teams that
require an immutable version should replace `main` with a published tag.

**Current status: architecture preview (static contract).** The Jev routing
runtime (JevAdapter, Policy Guard, lifecycle) is being implemented per
[task.md](task.md); what this repository ships today is the complete
normative contract, the Skill's static flow, and the observer dashboard.
With the contract installed, Root interprets the Policy as written (every
task falls back to Root when Jev is unavailable); full automatic Jev routing
arrives with P2–P4. You can also name it explicitly:

```text
Use $jev-auto-router:jev-auto-router to build this feature and verify it.
```

### Optional hardening: install the Reviewer profile (not required)

Neither core routing nor semantic review needs this. It adds value only if your
Codex build exposes a spawn parameter that selects an installed custom agent by
name; the reviewer can then receive the `read-only` sandbox the profile requests.

```sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
```

It installs exactly one allowlisted TOML (`jev-auto-router-astra-reviewer.toml`),
succeeds idempotently on identical content, and refuses to overwrite different
content. `--check` proves only byte-for-byte equality with the bundled template; it
does **not** prove a reviewer spawn, a fresh context, or effective isolation. Start a
new task afterwards, because custom agents are discovered at task creation.

## What you do

Give Root the outcome, constraints, and any important repository context. You do not
need to select or manage a lane; Root confirms from trusted current-task metadata
that it is `Astra` or `Sol` at `Medium` or higher, authors a bounded Task Capsule for
each implementation unit, hands route selection to Jev and governance to the Guard,
and owns verification and acceptance.

## Routes

Every implementation unit has exactly two possible outcomes: Root executes it
itself (`ROOT_DIRECT`), or it is delegated under a Guard-accepted RoutePlan.
There are no fixed lanes and no "single file goes to a cheap model, everything
else goes to a bigger one" shape heuristics.

```text
Task Capsule (five-section template + three mechanical checks)
  → Runtime Capability Catalog (only capabilities actually observed on this host)
  → RouteRequest → JevAdapter → Jev → RoutePlan
  → Policy Guard: execute only on ALLOW; every DENY returns to Root
  → Codex-native execution (requested vs observed recorded)
  → Root mechanical verification → (when triggered) fresh independent semantic
    review → Root final acceptance
```

- **Jev is the sole automatic selector**: root vs delegate, model, reasoning
  effort, agent, Skills, MCPs, tool scope, context strategy, and continuation
  strategy. If Jev times out, errors, returns something malformed, or is
  low-confidence, automatic delegation is unavailable and Root executes —
  degraded, never broken.
- **The Policy Guard has veto power and no rerouting power**: it validates
  schema, confidence, capability existence, bounded ownership, user
  authorization, concrete verification, recoverable baselines,
  least-privilege permissions, no unauthorized side effects, no child
  fan-out, benchmark qualification, and budgets. Its verdicts are exactly
  `ALLOW(RoutePlan)` or `DENY(reason) → Root`.
- **UNKNOWN is never MATCH**: every execution records requested vs observed
  (model, effort, agent, sandbox, permissions, ...). A more expensive but
  correct artifact may be adopted yet never counts as savings evidence; a
  weaker or unauthorized permission is a safety incident — restore, stop
  delegation, Root takes over.
- **Budgets**: hard ceiling of 3 worker executions per Main Task and a normal
  automatic economic ceiling of 2; a third execution requires benchmark
  qualification for that task profile, otherwise Root takes over.

Semantic review is not a mode; it is risk-triggered. Only when the change is
persistent **and** it touches a public interface, data structure, permission, or
security path — or the child reported non-empty `JUDGMENT CALLS` / `GAPS` — is
one fresh `gpt-6-astra` / `medium` reviewer dispatched. Each candidate gets at
most one review; it returns `ACCEPT`, `REVISE`, or `RECONSIDER`; isolation
strength is tiered from observed evidence (`ENFORCED_READ_ONLY` /
`BEHAVIORALLY_READ_ONLY` / `REVIEW_UNAVAILABLE`), and any change after a
verdict voids it.

See the [Runtime Router Policy](skills/jev-auto-router/references/routing-policy.md)
(sole canonical authority), [docs/solution.md](docs/solution.md) for the
architecture, and the [ADR index](docs/adr/README.md) for decision history.

## What happens automatically

Root keeps architecture, decomposition, the Task Capsule, mechanical
verification, escalation decisions, and acceptance in the primary task. Child
work substitutes for Root work; it does not duplicate it.

- **The dispatch gate is a template to fill, not a judgment call**: every
  section of OBJECTIVE / FILES AND OWNERSHIP / INTERFACES / CONSTRAINTS /
  VERIFICATION must be filled concretely, and three checks are purely
  mechanical — every owned path resolves, every verification command has
  already been executed by Root with its result recorded, and the repository
  is clean with a baseline captured. Any failure means the unit is not
  delegatable.
- **Requesting does not prove it happened**: after dispatch, compare the
  observed model, effort, and friends against the request. Mismatches split
  into safety versus attribution tracks; a host that exposes no routing
  metadata does not discard independently verified output — it records
  residual risk and never counts the run as verified savings.
- **Exactly one active child at a time**, and a child may not create
  descendants; reviewer and worker never run concurrently.
- **Restore first**: on failure, restore the baseline before deciding
  correction or takeover; a rejected patch is never invisibly repaired to
  avoid counting a failed attempt. Same-worker continuation is selectable
  only when runtime evidence proves the handle, identity, ownership, and
  runtime contract.

## Reading the payoff

What routing tries to save: **for benchmark-qualified task shapes, mechanical,
verifiable execution tokens move off the flagship model (Astra) onto cheaper
execution surfaces, while Astra's tokens and effort concentrate on judgment,
verification, and acceptance.** This is not a blanket savings promise —
end-to-end economics are benchmark-dependent, and the capsule, cold start,
Root's checks, and recovery all count toward cost (see the [benchmark
contract](docs/sdd/benchmark.md)).

There are three observation surfaces for reading that payoff. They are all
**observers only**: by design, the Dashboard, `ccusage`, Credit estimates, model
mix, and latency are never inputs to a routing decision, so these readings are
retrospective evidence, not a control loop.

1. **Model mix migration** (the most direct). Local session token share shifts as
   you use it: when delegation actually happens, non-flagship token share rises and
   Astra's share falls. The **Per-task usage** table on the page shows the exact
   per-model consumption of every task.

   ```sh
   npm run setup
   npm run dashboard
   ```

   Requires Node.js 22+ and a signed-in Codex CLI. The page distinguishes
   **Subscription usage** from **Credit**, and `Model mix` comes from local session
   token share, not an official per-task bill. The **Per-task usage** table lists
   each local session (≈ one task), most recent first, with per-model token counts
   and the task total; prompts, session ids, and directories are never shown.

   ![Jev Auto Router local Dashboard with subscription quota and per-model shares](docs/assets/jev-auto-router-dashboard.png)

2. **Per-session token attribution**. `ccusage` is installed as an exact-pinned
   project dependency and reads session tokens by model directly:

   ```sh
   npm run ccusage -- codex session --json --since <date> --until <date>
   ```

3. **A/B comparison** (the cleanest). Run the same task twice: once with this plugin
   disabled, once enabled. Compare the two sessions' total tokens, model
   distribution, and wall-clock time — the difference is the actual effect of
   routing.

Honest boundaries: the subscription quota exposes percentages only, so there is
**no official per-task Credit**; Credit-mode attribution is a token-share
approximation (the Dashboard marks it `estimated`). The payoff readout is
therefore "share migration and trend", not an exact per-task bill — and no
automatic savings are claimed before benchmark qualification.

## Updating

Update the marketplace plugin; there are no companion roles to reinstall. If you
installed the reviewer profile, rerun `--check` once to confirm it still matches the
bundled template byte for byte, then start a new task:

```sh
codex plugin marketplace upgrade jev-auto-router
codex plugin add jev-auto-router@jev-auto-router
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
```

For local development, install this checkout as a marketplace:

```sh
cd /absolute/path/to/jev-auto-router
codex plugin marketplace add /absolute/path/to/jev-auto-router
codex plugin add jev-auto-router@jev-auto-router
```

## Release

Create the version commit and tag locally, then push both (after the repository
rename, confirm your remote points at `miniLV/jev-auto-router`):

```sh
npm run release -- 0.2.0
git push origin master v0.2.0
```

The release script aligns `package.json`, `package-lock.json`, the plugin manifest,
and the marketplace tag, then runs the full test gate. A pushed tag triggers GitHub
Actions to verify the metadata on Node 22, run tests and typechecking, and create
the GitHub Release. The public Plugins Directory still requires review and
publication through the OpenAI submission portal.

## Verification

```sh
npm test
npm run typecheck
git diff --check
```

The tests cover the routing contract, the Task Capsule gate, Guard validation,
the execution contract, attempt budgets, review triggers, identity consistency
(including stale-identity sweeps), profile exactness, Dashboard isolation, and
the local `ccusage` adapter. They validate the static contract and do not prove
that any real dispatch, Jev call, or review ever executed.

## Privacy and boundaries

- The Dashboard binds only to `127.0.0.1`, runs read-only, and never controls routing.
- Raw Codex session logs remain in their local locations; local model attribution
  reads existing logs and does not upload sessions.
- This repository provides a Codex skill, a static contract, and the Jev
  integration seam — not a standalone background scheduler.
- Subscription exports use `officialCredit.kind = "subscription-quota"` and
  `localModelShare`; only Credit mode exposes `credits` in
  `estimatedCreditAttribution`. See the [Codex app-server
  documentation](https://learn.chatgpt.com/docs/app-server) for the protocol.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
