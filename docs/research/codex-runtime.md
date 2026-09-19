# Upstream research: Codex native runtime

Evidence report — not normative. The normative contract lives in `spec.md` and
`docs/sdd/`. Facts below are OFFICIAL (published Codex documentation fetched
2026-09-19) or OBSERVED (public issue trackers / SDK docs), marked per item.

## Record

| Field | Value |
| --- | --- |
| Documentation | <https://developers.openai.com/codex/subagents>, <https://developers.openai.com/codex/concepts/subagents>, <https://learn.chatgpt.com/docs/agent-configuration/subagents> |
| Repository | <https://github.com/openai/codex> (Apache-2.0, inspected 2026-09-19) |
| SDK surface docs | Codex SDK subagents guide (documents `spawn_agent`, `send_input`, `resume_agent`, `wait`, `close_agent`) |
| Inspected date | 2026-09-19 |

## Subagent workflows (OFFICIAL)

- Subagent workflows are enabled by default in current Codex releases; Codex
  only spawns subagents when explicitly asked.
- Codex (the parent) handles orchestration: spawning, routing follow-up
  instructions, waiting, closing agent threads. `/agent` switches threads.
- Subagents inherit the **current sandbox policy**, including interactive
  changes made during the session; per-agent sandbox overrides are possible
  (for example, marking one custom agent `read-only`).
- Approval requests can surface from inactive agent threads while the main
  thread is active.
- `agents.max_threads` (default 6), `agents.max_depth` (default 1),
  `agents.job_max_runtime_seconds` live under `[agents]` in config.
- Experimental fan-out tooling (`spawn_agents_on_csv`) exists behind
  `enable_fanout` — explicitly out of scope for this product (no fan-out).

## Custom agents (OFFICIAL)

- Built-in agents: `default` (general-purpose fallback), `worker`
  (execution-focused), `explorer` (read-heavy exploration).
- Custom agents are standalone TOML files under `~/.codex/agents/` (personal)
  or `.codex/agents/` (project-scoped). Each file defines one agent; `name`
  and `description` are required; `model`, `model_reasoning_effort`,
  `sandbox_mode`, `developer_instructions` are configurable. A custom agent
  whose name matches a built-in takes precedence.
- Codex loads these files as **configuration layers** for spawned sessions; the
  runtime reapplies the parent turn's live overrides after the role config is
  layered in. The format "may evolve as authoring and sharing mature" — treat
  it as an unstable surface.

## Spawn-surface drift (OBSERVED — why requested-vs-observed is mandatory)

Public regressions in Codex CLI v0.137.0 (June 2026) are direct evidence for
this product's execution-contract design:

- [openai/codex#26363](https://github.com/openai/codex/issues/26363): the
  model-visible `spawn_agent` tool schema in that release accepted only
  `fork_context`, `items`, `message` — no `agent_type`, model, or effort
  selector. Spawned children inherited the parent model/effort, and session
  metadata recorded `agent_role = None`, `agent_path = None`.
- [openai/codex#26868](https://github.com/openai/codex/issues/26868) (closed
  as duplicate): `~/.codex/agents/*.toml` custom agents not applied on spawn;
  children got generic nicknames, inherited parent model/effort, and recorded
  `agent_path = null`.

Consequences encoded in this repository's design:

1. A requested spawn configuration (model, effort, agent profile, fresh
   context) is **never assumed to have been applied**. The Capability Catalog
   is built from observed surfaces, and every execution records a
   requested-vs-observed contract with explicit states — `UNKNOWN` is never
   `MATCH`.
2. Continuation ("same worker") is only selectable when a runtime handle and
   worker identity are observable. Issues above show identity fields can be
   `null` on real hosts, so unprovable continuation is simply absent from the
   catalog.
3. Model/effort per child remains ADR 0011's mechanism (per-spawn tuple), but
   the tuple's *values* now come from a Jev RoutePlan validated against the
   catalog, not from a fixed table.

## MCP and Skills (OFFICIAL summary)

- MCP servers are configured in Codex config; MCP tools are discovered via
  `initialize` + `tools/list` (the same discovery JevRouter uses). P5 routes
  MCP/tool scope only after model/agent routing is stable.
- Skills ship as directories with `SKILL.md` frontmatter (this repository's
  own distribution format).

## What Codex does not give us (gaps that stay Root-owned)

- No routing intelligence: Codex executes spawns; it does not choose among
  them. That is Jev's role here.
- No verification of child output: parent inspection is a workflow discipline,
  not a platform service. That is Root's mechanical verification.
- No persistence of decision state across stateless sessions; lifecycle state
  is transient and Root-owned.

## Mapping to this product's slices

| Slice | Codex surface used | Status |
| --- | --- | --- |
| Model / effort / agent / context mode | Per-spawn parameters and custom-agent TOML | First stable slice |
| Skills | Skill frontmatter and per-task discovery | Second slice |
| MCPs / tools / permissions | MCP config + `tools/list`, sandbox/approval surfaces | Third slice |
