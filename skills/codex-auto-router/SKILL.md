---
name: codex-auto-router
description: Automatically consider every Main Task once, and delegate implementation work to a fixed Luna or Terra native child while Root keeps all judgment and final verification.
---

# Codex Auto Router

A shallow Adapter around the canonical [Runtime Router
Policy](references/routing-policy.md). Its metadata enables implicit consideration for
every Main Task. It does not restate route rules, tuples, or fallback state.

This is a static contract interpreted by Root. It adds no router engine,
classifier, registry, telemetry, or Dashboard control path. No Node service,
Dashboard, `npm run setup`, or `ccusage` install is required.

## Prerequisite

Root must be `gpt-6-astra` at `medium` reasoning or higher, confirmed from
trusted current-task runtime metadata. If it is lower, or cannot be confirmed,
do nothing and keep the work in Root.

Delegation uses the native `spawn_agent` surface. If that surface is
unavailable, keep the work in Root; it is not a setup prerequisite.

## Use

1. Preserve the user's request, authorization, constraints, and upstream Skill.
2. Apply the Runtime Router Policy gate once. Classify by **nature**
   (implementation vs. judgment), not by difficulty.
3. Judgment work stays in Root, always. This includes writing the dispatch
   specification itself.
4. For implementation work, fill the five-section dispatch template. If any
   section cannot be filled concretely, do the work in Root instead.
5. Capture a baseline for every writable path, then dispatch exactly one child
   using the Policy's fixed tuple for the selected channel.
6. Compare the child's observed model and effort against what was requested.
   A reported mismatch rejects the output; metadata the host does not expose
   is recorded as residual risk, not treated as a rejection.
7. Verify mechanically: read the complete diff and rerun the specification's
   verification commands yourself. Treat the child's report as a claim.
8. Run at most one semantic review for each eligible candidate, within the
   Policy's five-review task budget.
9. Adopt, correct once, or restore the baseline and continue in Root.

## What Root never delegates

Requirements and ambiguity resolution, architecture and decomposition, writing
the dispatch specification, mechanical verification, external actions (push, PR,
messages), conversational turns, and final delivery.
