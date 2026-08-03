<h1 align="center">Codex Auto Router</h1>
<p align="center">
  <img src="docs/diagrams/auto-routing-en.png" alt="Codex Auto Router hand-drawn main flow" width="900">
</p>
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
- **Local and auditable**: the policy, Task Packet, and lifecycle live in this repository, with an optional Dashboard and no black-box scheduler.

> **Recommended setup:** Use Sol as Root for strategy, complex judgment, integration, and final verification; let Auto Router send Gate-approved bounded execution to Terra or Luna. This is a recommendation, not a prerequisite, and the Skill never changes the user's selected Root model.

### Why routing matters now

The trade-off is clearer in the chart: points farther toward the upper-left deliver more intelligence at a lower cost per task. Sol fits high-judgment work, Luna fits low-risk execution, and Terra sits between them; routing chooses the right model when the boundaries are clear.

[![Intelligence and cost per task for GPT-5.6 Sol, Terra, and Luna](docs/assets/gpt-models.avif)](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)

That is this project's value: it does not blindly downgrade tasks. It moves execution from the current Root to Luna or Terra only after the Gate, exact paths, baselines, recovery, and deterministic verification are satisfied. Subscription Codex Credit and API token billing are separate measures; the Dashboard identifies its data source and never presents API prices as a linear conversion of subscription allowance. See OpenAI's [GPT-5.6 announcement](https://openai.com/index/gpt-5-6/) for model positioning; the chart and independent analysis come from [Artificial Analysis](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/).

## Install the Skill

Most users only need to paste this into Codex:

```text
Install this Codex skill:
https://github.com/miniLV/codex-auto-router/tree/v0.1.1/skills/codex-auto-router
```

The skill is available from the next task. Routing comes from the skill; no Node service or Dashboard is required.

If you prefer to install it as a Codex plugin from its marketplace, run:

```sh
codex plugin marketplace add miniLV/codex-auto-router --ref v0.1.1
codex plugin add codex-auto-router@codex-auto-router
```

These commands only install the skill package. They do not run `npm run setup` and do not require `ccusage`.

## Core flow

Every Main Task is automatically **considered once**, but consideration does not imply delegation:

1. Root keeps the user goal, authorization, and constraints.
2. The router reads the single canonical Runtime Router Policy and evaluates the complete gate.
3. Gate failure, judgment, external actions, destructive work, or tightly coupled context stays `ROOT_DIRECT`.
4. After the gate passes, only these native tuples are available:

| Route | Model tuple | Scope |
| --- | --- | --- |
| `ROOT_DIRECT` | Current Root model | Complex judgment, external actions, unverifiable work, or work not worth splitting |
| `LUNA_XHIGH_BACKGROUND` | `gpt-5.6-luna` · `xhigh` · `fork_turns: none` | Only `READ_LOG_WINDOW` and `WRITE_UNIT_TESTS` |
| `TERRA_HIGH_BACKGROUND` | `gpt-5.6-terra` · `high` · `fork_turns: none` | Other eligible bounded execution |

5. Only one child may be active. Root compares the result with the baseline, runs deterministic verification, and then adopts or restores it.

### Why Root should not do every execution

When Root uses a high-capability model such as Sol, it is best reserved for high judgment, complex context, and final responsibility. Using it for every mechanical, repeatable background unit increases cost. Terra and Luna cover clear, verifiable work at lower execution cost, but this is not an unconditional downgrade:

- Luna is limited to its exact allowlist.
- Terra owns other eligible bounded work and gets at most two focused repairs.
- After a Luna failure, Root resolves its diff and may create one fresh Terra task; there is no second Luna.
- Any uncertainty returns to Root.

See the [Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md), [Task Packet](skills/codex-auto-router/references/task-packet.md), and [Native Subagent Lifecycle](skills/codex-auto-router/references/native-subagent-lifecycle.md) for the complete contract.

## Verification

```sh
npm test
npm run typecheck
git diff --check
```

The tests cover the routing contract, model tuples, Task Packet, lifecycle boundaries, Dashboard isolation, and the local `ccusage` adapter.

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

This project is licensed under the [Apache License 2.0](LICENSE). See the [Skill NOTICE](skills/codex-auto-router/NOTICE.md) for upstream MIT attribution.
