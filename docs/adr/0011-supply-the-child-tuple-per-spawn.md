# Supply the child tuple per spawn, and treat a named profile as optional

Status: Accepted.

## Decision

Delegation supplies `model`, `reasoning_effort`, and `fork_turns` as parameters
of the native spawn call, and places child instructions in the spawn message. An
installed custom-agent profile is optional hardening, never a prerequisite. The
core install path is therefore two plugin commands with no file written to any
user directory, no `jq`, and no Node service.

## Evidence

Observed on one host (codex-cli 0.145.0; session `cli_version` 0.146.0-alpha.9.2;
`features.multi_agent_v2` enabled), across 300 sampled rollouts under
`~/.codex/sessions`:

- 134 `spawn_agent` calls used exactly these argument keys: `task_name`,
  `message`, `fork_turns`, `model`, `reasoning_effort`, `service_tier`. No key
  selected a named custom agent.
- `fork_turns` was present on 134 of 134 calls, and `"none"` was the value in
  observed delegation.
- `session_meta.payload` carried no top-level `agent_role` in 442 records. The
  nested `source.subagent.thread_spawn.agent_role` was `null` in the observed
  subagent spawn; identity was carried by `agent_path` (`/root/<task_name>`) and
  `agent_nickname`.
- `turn_context.payload` never carried `fork_turns` in 495 records.
- `sandbox_policy.type` was `danger-full-access` in 495 records.

## Limits of that evidence

This is a single host and a single build. It shows observed usage, not the tool
schema, and the same host's `config.toml` references an `agent_type` concept. It
therefore cannot establish that no Codex build exposes named-agent spawning.

Consequently the profile and its installer are retained rather than removed, and
section 7 of the Policy branches on availability instead of asserting absence. If
a build does expose the parameter, that path additionally yields the requested
`read-only` sandbox. If it does not, the reviewer inherits Root's sandbox and the
review may only proceed as behaviourally read-only with an explicit before-and-
after state comparison and a recorded residual risk.

## Consequences

- The skill works with zero setup on any build that exposes `spawn_agent`.
- Nothing claims that installing a profile proves a spawn, a fresh context, or
  isolation.
- `scripts/inspect-reviewer-runtime.sh` was removed: it read a top-level
  `agent_role` and a `turn_context.fork_turns` that no observed rollout
  contained, and its fixture encoded that same unvalidated schema, so the test
  could not detect the mismatch.
