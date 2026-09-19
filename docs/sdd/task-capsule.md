# Task Capsule

The Task Capsule is the bounded handoff packet Root produces for one
decomposed implementation unit. It is what the router sees, what a worker
executes against, and what a reviewer judges against.

## Principle

The capsule is an **economic boundary**. Duplicating Root's whole conversation
into every child erases routing savings in context re-reads. The capsule
carries exactly what is needed to execute and verify one unit — no more.

## Required fields

| Field | Meaning |
| --- | --- |
| `task_unit_id` | Stable identity for receipts and budget accounting |
| `objective` | Observable outcome and why it matters |
| `rationale` | Why this unit exists in the decomposition |
| `owned_paths` | Exact writable paths/resources; pairwise non-overlapping; globs forbidden |
| `interfaces` | Signatures/types/schemas/behavior that must stay compatible, or literal `none` |
| `constraints` | Repository conventions, safety boundaries, excluded scope, settled decisions |
| `authorization_boundary` | What the user authorized for this unit (writable class, side effects) |
| `success_criteria` | Concrete, checkable conditions |
| `verification` | Exact commands + expected results (pre-run by Root), inspection evidence |
| `baseline` | Captured state reference for every owned writable path |
| `risk_flags` | Known risks (public interface, security, schema, judgment calls) |
| `side_effect_class` | `read_only` / `bounded_write` / `external_action_forbidden` etc. |
| `context_references` | Pointers (paths, symbols, digests) instead of pasted content where possible |

The five-section **dispatch specification** (OBJECTIVE, FILES AND OWNERSHIP,
INTERFACES, CONSTRAINTS, VERIFICATION + RETURN) is the worker-facing projection
of the capsule and is authored by Root (never by Jev — Jev cannot generate
text).

## Construction rules

1. Root authors the capsule **before** routing; the router never writes it.
2. Owned paths resolve literally or are explicitly new; no prefix-overlap.
3. Every executable verification command was run by Root pre-dispatch
   (captures the behavioral before-state).
4. No active merge/rebase conflict; authorization covers the side-effect class.
5. Default: do **not** copy the full Root conversation. Duplicated context
   above the capsule budget is a routing cost signal, not free.

## Capsule cost measurement

The Decision Receipt records capsule size (tokens) and the benchmark counts it
against end-to-end cost (`spec.md` §15). A profile whose capsule overhead erases
its execution savings is not qualified for automatic routing.

## Capsule evolution during correction

A corrected retry may carry failure evidence additions, but ownership,
authorization, and success criteria may only *narrow*. Broadening them is new
scope and requires user authorization.
