---
name: jev-auto-router
description: Automatically consider every Main Task once, route each bounded implementation unit through Jev and the Policy Guard, execute accepted plans on native Codex agents, and keep all judgment, verification, and final acceptance in Root.
---

# Jev Auto Router

A shallow Adapter around the canonical [Runtime Router
Policy](references/routing-policy.md). Its metadata enables implicit
consideration for every Main Task. It does not restate route rules, schemas,
guard checks, or fallback state.

This is a static contract interpreted by Root, plus the Jev integration seam
the Policy defines. It adds no route-selection code, classifier, registry,
telemetry, or Dashboard control path in this repository.

## Prerequisite

Root must be `gpt-6-astra` or `gpt-5.6-sol` at `medium` reasoning or higher,
confirmed from trusted current-task runtime metadata. If it is another model
or cannot be confirmed, do nothing and keep the work in Root.

Jev is the routing brain; when the Jev integration is unavailable, times out,
errors, or returns a low-confidence or malformed plan, automatic delegation
is unavailable and Root executes — degraded, never broken.

Delegation uses the native `spawn_agent` surface. If that surface is
unavailable, keep the work in Root; it is not a setup prerequisite.

## Use

1. Preserve the user's request, authorization, constraints, and upstream Skill.
2. Judgment work stays in Root, always: requirements, architecture,
   decomposition, authoring the Task Capsule and dispatch specification,
   verification, external actions, and final acceptance.
3. For an implementation unit, author the bounded Task Capsule (the
   five-section dispatch template). If any section cannot be filled
   concretely, do the work in Root instead.
4. Build the Runtime Capability Catalog of what the host actually provides
   now; UNKNOWN evidence means absent.
5. Route: RouteRequest → JevAdapter → Jev → RoutePlan → Policy Guard. The
   Guard's only verdicts are ALLOW (execute exactly the plan) and DENY →
   Root. Jev may return `decision: root`; that is a first-class outcome.
6. Capture a baseline for every writable path, then execute the accepted
   plan on exactly one child with the plan's model, effort, agent, and
   context mode.
7. Record the requested-versus-observed execution contract. UNKNOWN is never
   MATCH; a weaker or unauthorized permission or scope is a safety failure
   (restore, stop delegation), not just an attribution note.
8. Verify mechanically: read the complete diff and rerun the capsule's
   verification commands yourself. Treat the child's report as a claim.
9. Run at most one risk-triggered fresh semantic review per candidate, within
   the Policy's execution-budget-bound review budget.
10. Adopt, or restore and let Jev re-route with structured failure evidence
    within the attempt budgets (hard ceiling 3 executions; automatic
    economic ceiling 2). Take over in Root when the budgets or the evidence
    say so.

## What Root never delegates

Requirements and ambiguity resolution, architecture and decomposition,
authoring the Task Capsule and dispatch specification, route-adjacent
judgment, mechanical verification, external actions (push, PR, messages),
conversational turns, and final delivery.
