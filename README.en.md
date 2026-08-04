<h1 align="center">Codex Auto Router</h1>
<p align="center">
  <strong>Route Codex Main Tasks across quality, cost, and safety boundaries.</strong>
</p>

<p align="center">
  Root keeps high-judgment quality; Terra / Luna handle lighter, cost-efficient bounded work in the background.
</p>

<p align="center">
  <a href="https://github.com/miniLV/codex-auto-router">GitHub</a> ·
  <a href="README.md">简体中文</a> · <strong>English</strong>
</p>

<p align="center">
  <a href="#install-the-skill"><strong>Install the Skill</strong></a> ·
  <a href="#core-flow"><strong>Core flow</strong></a> ·
  <a href="#optional-local-dashboard"><strong>Optional Dashboard</strong></a>
</p>



<p align="center">
  <img src="assets/auto-router-cover.png" alt="Codex Auto Router plugin cover" width="420">
</p>

## What it solves

An AI coding assistant should not send every task to the most expensive model, and it should not trade away Root's judgment or final verification just to save cost. This project separates those responsibilities:

- **Root / the current model protects quality**: it keeps user intent, authorization, complex judgment, external actions, integration, final verification, and delivery.
- **Terra / Luna reduce execution cost**: only independent, bounded, restorable, deterministically verifiable units go to the background; they are usually lighter and faster for repeatable engineering work.
- **Safety beats price**: cost is never the only routing signal. Unclear ownership, baselines, recovery, or acceptance returns the task to `ROOT_DIRECT`.
- **Local and auditable**: the policy, dispatch template, and lifecycle live in this repository, with an optional Dashboard and no black-box scheduler.

> **Root condition:** Background routing is allowed only when Root is `Sol` at `Medium` reasoning or higher. The Skill never switches, upgrades, or downgrades Root. A non-Sol, `Low`, or unverified Root tuple stays `ROOT_DIRECT`.

### Why routing matters now

The trade-off is clearer in the chart: points farther toward the upper-left deliver more intelligence at a lower cost per task. Sol fits high-judgment work, Luna fits low-risk execution, and Terra sits between them; routing chooses the right model when the boundaries are clear.

[![Intelligence and cost per task for GPT-5.6 Sol, Terra, and Luna](docs/assets/gpt-models.avif)](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)

That is this project's value: it does not blindly downgrade tasks. It moves execution from the current Root to Luna or Terra only after the Gate, exact paths, baselines, recovery, and deterministic verification are satisfied. Subscription Codex Credit and API token billing are separate measures; the Dashboard identifies its data source and never presents API prices as a linear conversion of subscription allowance. See OpenAI's [GPT-5.6 announcement](https://openai.com/index/gpt-5-6/) for model positioning; the chart and independent analysis come from [Artificial Analysis](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/).

## Install the Skill

Install it as a plugin. It needs no Node service, Dashboard, or `ccusage`:

```sh
codex plugin marketplace add miniLV/codex-auto-router --ref main
codex plugin add codex-auto-router@codex-auto-router
```

This marketplace follows `main` so users receive the current version. Teams
that require an immutable version should replace `main` with a published tag.

**That is the whole setup.** Start a new Codex task and it is active. No custom
agent to install, no `jq`, no Node service, and no Dashboard. Model, reasoning
effort, and fresh context are all supplied as `spawn_agent` parameters, so
nothing depends on a configuration file in a user directory.

## Core flow

Every Main Task is automatically **considered once**, but consideration does not imply delegation:

1. Root keeps the user goal, authorization, and constraints.
2. Trusted current-task metadata must confirm `Sol / Medium` or higher; the router never changes it.
3. The router reads the single canonical Runtime Router Policy and evaluates the complete gate.
4. An unsupported Root profile, gate failure, judgment, external actions, destructive work, or tightly coupled context stays `ROOT_DIRECT`.
5. After the gate passes, only these native tuples are available:

| Route | Model tuple | Scope |
| --- | --- | --- |
| `ROOT_DIRECT` | Current Root model | Judgment work, external actions, and anything failing a mechanical check |
| `LUNA` | `gpt-5.6-luna` · `xhigh` · `fork_turns: none` | A read-only evidence window, or a bounded write in one file that changes no public interface and verifies with one binary command |
| `TERRA` | `gpt-5.6-terra` · `high` · `fork_turns: none` | Other eligible bounded implementation |

6. The gate is a **template to fill**, not a judgment call. Every section of the five-part spec must be filled concretely, and three of those checks are purely mechanical: every owned path resolves, every verification command has already been executed by Root with its result recorded, and the repository is clean with a baseline captured. Any failure means Root does the work.
7. At most five dispatches per Main Task: the original plus up to four retries with corrected specifications. Repeating an unchanged prompt is forbidden. Failure on the fifth dispatch means restore the baseline and finish in Root under the original authorization.
8. Exactly one active child, and a child may not create descendants. A child ends and its ownership is resolved before any semantic review begins, so reviewer and worker never run at the same time.
9. On collection, Root verifies mechanically: read the complete diff, rerun the verification commands the child's changes could affect, and reuse the pre-dispatch results for the rest. A semantic review runs only when the change is persistent **and** it touches a public interface, data structure, permission, or security path, or the child reported non-empty `JUDGMENT CALLS` or `GAPS`. Each candidate gets at most one review and a Main Task at most five. The review judges both the diff and whether the specification itself was adequate, and returns `ACCEPT`, `REVISE`, or `RECONSIDER`. Spanning multiple files is not a trigger by itself, and skipping review under these rules never counts as reviewed.

### Why Root should not do every execution

When Root uses a high-capability model such as Sol, it is best reserved for high judgment, complex context, and final responsibility. Using it for every mechanical, repeatable background unit increases cost. Terra and Luna cover clear, verifiable work at lower execution cost, but this is not an unconditional downgrade:

- Luna is limited to shapes that can be checked mechanically.
- Terra owns other eligible bounded implementation.
- Every writable path has a baseline before dispatch. When a child fails or its output cannot be verified, restore the baseline and finish in Root rather than dispatching again.
- Requesting a tuple does not prove it was applied: after dispatch, compare the **observed** model and effort against the request. A reported mismatch rejects the output; a host that exposes no routing metadata does not — mechanical verification and semantic review re-derive correctness from the artifact itself, and the unverified tuple is recorded as residual risk.
- Restoring a candidate and finishing in Root is not termination of the user's goal and needs no new authorization. Expanding scope, changing the architecture, or starting new delegated work does.

See the [Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md) for the complete contract.

### Optional: install the Reviewer profile (hardening, not required)

Neither core routing nor semantic review needs this. It adds value only if your
Codex build exposes a spawn parameter that selects an installed custom agent by
name; the reviewer can then receive the `read-only` sandbox the profile requests.

```sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh --check
```

It installs exactly one allowlisted TOML, succeeds idempotently on identical
content, and refuses to overwrite different content. `--check` proves only
byte-for-byte equality with the bundled template; it does **not** prove a
reviewer spawn, a fresh context, or effective isolation. Start a new task
afterwards, because custom agents are discovered at task creation.

Without that spawn parameter the reviewer is created from per-spawn parameters
and inherits Root's sandbox. Review then proceeds only when hard isolation is
not required, the prompt forbids edits, and Root compares exact before-and-after
state, reporting the broader sandbox as residual risk. Neither path is ever
described as the other.

### Why routing does not use time or Dashboard Credit

There is no trustworthy per-task Credit input, and the Policy performs no cost estimation at all: delegation depends only on whether the task shape passes the mechanical gate. Dashboard, `ccusage`, `src/credit.ts`, Credit estimates, and model mix are explicitly not routing inputs; latency remains a separate constraint.

## Verification

```sh
npm test
npm run typecheck
git diff --check
```

The tests cover the routing contract, model tuples, the dispatch template, the two-dispatch limit, the review triggers, profile exactness, Dashboard isolation, and the local `ccusage` adapter. They validate the static contract and do not prove that any real dispatch or review ever executed.

## Privacy and boundaries

- The Dashboard binds only to `127.0.0.1`.
- Raw Codex session logs remain in their local locations.
- Local model attribution reads existing logs and does not upload sessions.
- This repository provides a Codex skill and static contract, not a standalone background scheduler.

## Optional: local Dashboard

The Dashboard is not required to use the skill. Run it only when you want a local view of subscription quota, Credit status, and Sol/Terra/Luna token share:

```sh
git clone https://github.com/miniLV/codex-auto-router.git
cd codex-auto-router
npm run setup
npm run dashboard
```

It requires Node.js 22+ and a signed-in Codex CLI. `ccusage` is installed as an exact-pinned project dependency; no global command is required. Open the printed `127.0.0.1` URL.

The page distinguishes **Subscription usage** from **Credit** and never mixes either with OpenAI Platform API token billing. **Model mix** comes from local session token share, not an official per-task bill. If refresh fails, **Debug log** and **Copy debug** provide a safe copyable diagnostic snapshot.

![Codex Auto Router local Dashboard with subscription quota and Luna 44.9%, Terra 31.0%, and Sol 24.1% model shares](docs/assets/codex-auto-router-dashboard.png)

Subscription exports use `officialCredit.kind = "subscription-quota"` and `localModelShare`; only Credit mode exposes `credits` in `estimatedCreditAttribution`. The Dashboard binds only to `127.0.0.1`, is read-only, and never controls routing. See the [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server) for the protocol.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
