# Shared Context

This glossary describes the v2.1 automatic-routing contract. The
[Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md)
is the sole canonical deep runtime Module; this file is explanatory context
and cannot define a route.

| Term | Definition |
| --- | --- |
| Main Task | The user-visible task in which the request is received and the final result is delivered. |
| Root Agent | The owner of intent, planning, high-judgment decisions, external actions, integration, final verification, and delivery. |
| Root Model | The model selected for the Main Task. Automatic routing never changes it. |
| Auto Router | The shallow Adapter that automatically considers every Main Task and delegates only when the canonical Policy gate passes. |
| Runtime Router Policy | The sole canonical deep runtime Module for route eligibility, fixed native tuples, break-even, and fallback. |
| Interface | The Task Packet contract between Root and a bounded child. It carries objective, exact scope, baseline, constraints, verification, restore, and evidence fields. |
| Seam | The native-subagent lifecycle boundary where Root creates, collects, verifies, adopts, or restores child output. |
| Adapter | A shallow integration layer such as Skill metadata. An Adapter points to the Module and cannot duplicate its state machine or route table. |
| Depth | The number of delegation layers. v2.1 permits at most one active child, and a child may not delegate. |
| Locality | The bounded ownership rule: exact mutually exclusive paths, captured baselines, deterministic checks, and explicit restore/adoption state. |
| Route Request | The current user request together with every upstream Skill and constraint that routing must preserve. |
| Route Decision | Exactly `ROOT_DIRECT`, `LUNA_XHIGH_BACKGROUND`, or `TERRA_HIGH_BACKGROUND`, as returned by the Policy. |
| Task Packet | A self-contained handoff that gives one child its route tuple, objective, scope, baseline, constraints, prohibitions, break-even, acceptance, verification, restore, and evidence contract. |
| Luna allowlist | The two exact units eligible for the Luna tuple: `READ_LOG_WINDOW` and `WRITE_UNIT_TESTS`. Every other eligible bounded execution unit uses Terra. |
| Terra repair budget | The same-session limit of an initial Terra attempt plus at most two focused repair follow-ups. |
| Delegation Break-even | A strict comparison in one consistent unit, preferably minutes: expected benefit must exceed the sum of packet preparation, supervision/review, and likely recovery. Missing or uncertain values mean Root Direct. |
| Dashboard | Dashboard is an independent, read-only observer and never a routing input or control. Its history, credits, labels, and estimates cannot affect a decision. |
| Static contract | Documentation, metadata, and static tests that validate shapes and boundaries. They do not prove runtime enforcement. |
| Runtime proof | Evidence from a real platform invocation and Root verification; it is separate from static contract checks. |
| Global orchestration conflict | The current global `codex-orchestration` policy conflict. It blocks the v2.1 pilot; this repository makes no global configuration edits. |

The contract deliberately has no executable router engine, classifier, registry,
LLM router, routing dependency, telemetry, or Dashboard control artifact.

The current global `codex-orchestration` policy conflict blocks the v2.1 pilot;
this repository makes no global configuration edits.
