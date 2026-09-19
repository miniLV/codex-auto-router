# Architecture Decision Records

The sole normative routing authority is
`skills/jev-auto-router/references/routing-policy.md`, now expressed as the
Policy Guard contract under the Jev-native architecture (ADR 0013). ADRs
0001–0010 record decisions from an earlier revision of the contract and are
superseded; they are kept as history only. ADRs 0011 and 0012 remain valid in
the parts recorded by ADR 0013; ADR 0013 records the Jev-native architectural
reset.

| ADR | Decision | Status |
| --- | --- | --- |
| 0001 | Tier Fresh Review isolation by observed runtime evidence | Superseded |
| 0002 | Install and exactly check one pinned Reviewer profile | Superseded |
| 0003 | Bound one Delivery Cycle to three Worker dispatches | Superseded |
| 0004 | Share the budget across Luna, Terra, and corrections | Superseded |
| 0005 | Require approval only for new scope, architecture, or automated cycle | Superseded |
| 0006 | Require Fresh Review for persistent changes | Superseded |
| 0007 | Gate on structured Expected Sol Work Reduction | Superseded |
| 0008 | Separate mechanical Root Verification from semantic Fresh Review | Superseded |
| 0009 | Prefer the original Worker for bounded corrections | Superseded |
| 0010 | Recheck Expected Sol Work Reduction before correction | Superseded |
| 0011 | Supply the child tuple per spawn | Accepted (retained by 0013) |
| 0012 | Gate delegation with a template, not a cost estimate | Partially superseded by 0013 |
| 0013 | Jev-native routing architecture: Jev selects, Guard validates, Root verifies | Accepted |
