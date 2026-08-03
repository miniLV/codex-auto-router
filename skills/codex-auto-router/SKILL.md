---
name: codex-auto-router
description: Automatically consider every Main Task for one safe, bounded native child execution; the canonical routing policy and lifecycle references define eligibility and execution.
---

# Codex Auto Router

This Skill is a shallow Adapter around the canonical [Runtime Router
Policy](references/routing-policy.md). Its metadata enables implicit
consideration for every Main Task. It does not duplicate route rules, model
tuples, fallback state, or an independent state machine.

The metadata hook is the automatic entry point: when this Skill is loaded,
Codex considers the Main Task for native background execution without waiting
for a Dashboard or `npm run setup`. The policy and lifecycle references define
the route, and the native-subagent surface performs the invocation. If that
surface is unavailable, keep the work in Root rather than treating setup as a
skill prerequisite.

## Use

1. Preserve the user's request, authorization, constraints, and upstream Skill.
2. Read the Runtime Router Policy and apply its complete gate once.
3. For a background decision, read the [Task Packet](references/task-packet.md)
   and [Native Subagent Lifecycle](references/native-subagent-lifecycle.md),
   then invoke the selected native child with a fresh context.
4. Keep Root ownership of intent, planning, judgment, external actions,
   integration, final verification, and delivery.
5. Verify, adopt, or restore child output before closing the task.

The packaged Skill contains no executable router engine or Dashboard
dependency. Static checks verify the contract's shape; a successful runtime
invocation is separate proof of the host's native-subagent integration.
