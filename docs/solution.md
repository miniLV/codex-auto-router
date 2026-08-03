# Codex Auto Router Architecture

The repository ships a static contract, not an executable router engine. The
[Runtime Router Policy](../skills/codex-auto-router/references/routing-policy.md)
is the sole source of routing rules.

## Deep-module boundaries

- **Module:** `references/routing-policy.md` owns eligibility, route selection,
  limits, and failure behavior.
- **Interface:** `references/task-packet.md` defines the complete handoff.
- **Seam:** `references/native-subagent-lifecycle.md` defines native child
  ownership, verification, adoption, and restoration.
- **Adapters:** `SKILL.md` and `agents/openai.yaml` expose the Policy without
  copying its state machine.

## Runtime compatibility

If another routing or orchestration authority governs the current task, this
Skill stands down to `ROOT_DIRECT`. The Dashboard remains a read-only observer
and never influences routing.

## Validation and proof

`npm test`, `npm run typecheck`, and `git diff --check` validate the static
contract. Runtime enforcement still requires a real native-child invocation
and deterministic Root verification.
