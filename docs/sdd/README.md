# System design documents (SDD)

These documents are the durable subsystem designs for **Jev Auto Router**
(`jev-auto-router`). `spec.md` at the repository root is the normative
product/system specification; these documents expand it without redefining it.
`docs/research/` holds external evidence and is never normative.

| Document | Scope |
| --- | --- |
| [architecture.md](architecture.md) | The five roles, control flow, failure flow, depth model |
| [task-capsule.md](task-capsule.md) | The bounded Root→worker handoff packet and its economics |
| [capability-catalog.md](capability-catalog.md) | Truthful runtime capability discovery |
| [jev-adapter.md](jev-adapter.md) | The only seam to the TypeSafe Jev API |
| [route-plan.md](route-plan.md) | RouteRequest / RoutePlan normalized schemas |
| [policy-guard.md](policy-guard.md) | The deterministic validator: veto, no alternates |
| [delivery-lifecycle.md](delivery-lifecycle.md) | Baseline, verification, review, isolation tiers, correction, budgets |
| [decision-receipt.md](decision-receipt.md) | Auditable evidence per routed attempt |
| [benchmark.md](benchmark.md) | Arms, strata, metrics, anti-p-hacking, qualification |
| [acceptance-cases.md](acceptance-cases.md) | A01–A30 behavioral acceptance cases and the review-finding closure map |

## Status conventions

- Normative language: MUST/SHOULD/MAY as in RFC 2119, scoped by `spec.md`.
- Anything marked `UNVERIFIED` is design intent pending runtime evidence; the
  static contract (docs + tests) proves shape only, never runtime enforcement.
