---
name: codex-auto-router
description: Automatically consider every Main Task for one safe, bounded native child execution; the canonical routing policy and lifecycle references define eligibility and execution.
---

# Codex Auto Router

This Skill is a shallow Adapter around the canonical [Runtime Router
Policy](references/routing-policy.md). Its metadata enables implicit
consideration for every Main Task. It does not duplicate route rules, model
tuples, fallback state, or an independent state machine.

## Use

1. Preserve the user's request, authorization, constraints, and upstream Skill.
2. Read the Runtime Router Policy and apply its complete gate once.
3. For a background decision, read the [Task Packet](references/task-packet.md)
   and [Native Subagent Lifecycle](references/native-subagent-lifecycle.md),
   then invoke the selected native child with a fresh context.
4. Keep Root ownership of intent, planning, judgment, external actions,
   integration, final verification, and delivery.
5. Verify, adopt, or restore child output before closing the task.

The packaged Skill contains no executable router engine. Static checks verify
the contract's shape; a successful runtime invocation is separate proof.
