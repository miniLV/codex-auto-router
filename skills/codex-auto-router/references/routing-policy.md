# Runtime Router Policy

Policy version: `2.1.0`

This file is the sole canonical deep runtime Module for automatic routing. It
owns route eligibility, the route tuple, and fallback behavior. The Route
Decision and Task Packet are Interfaces; native child invocation is the
Lifecycle Seam; and `SKILL.md` plus `openai.yaml` are shallow Adapters. No
other document, Dashboard, model history, or task label may override this
Module.

This is a static contract for the packaged Skill. It does not create an
executable router engine, classifier, registry, LLM router, telemetry system,
or Dashboard control path.

## Activation and stand-down

The Skill metadata sets `allow_implicit_invocation: true`: every Main Task is
automatically considered once. Consideration is not delegation. Delegation
occurs only when the complete gate below passes.

Stand down to `ROOT_DIRECT` without delegating when:

- another active routing or orchestration authority governs the same task;
- an active merge or rebase conflict exists; or
- ownership, scope, baseline, or restore state is ambiguous.

Preserve the user's request, authorization, constraints, and every upstream
Skill. Automatic routing changes only where one bounded unit runs. Root keeps
intent, planning, high-judgment decisions, external actions, integration,
final verification, and delivery. The Root Model never changes. Sol Medium is
only an external-deployment assumption; it is not a route or a Root-model
override.

Dashboard is an independent, read-only observer and never a routing input or
control. Dashboard history, credits, task labels, and model history cannot
affect a Route Decision.

## Route decisions

Return exactly one of these decisions:

- `ROOT_DIRECT`
- `LUNA_XHIGH_BACKGROUND`
- `TERRA_HIGH_BACKGROUND`

The native child tuple is fixed:

```yaml
LUNA_XHIGH_BACKGROUND:
  model: gpt-5.6-luna
  reasoning_effort: xhigh
  fork_turns: none
TERRA_HIGH_BACKGROUND:
  model: gpt-5.6-terra
  reasoning_effort: high
  fork_turns: none
```

Choose a background route only when **all** gate conditions are true:

1. The unit is substantial and bounded, and can be separated without changing
   the user's objective or upstream workflow.
2. The repository is safe for delegation: no active merge/rebase conflict and
   no unresolved ownership or scope ambiguity.
3. Exact, mutually exclusive Worker-owned writable paths are declared, or a
   read-only unit declares its exact path and time/line window.
4. A captured preflight baseline exists for every writable path.
5. Fresh-context suitability is confirmed for the selected native tuple.
6. Deterministic verification and expected results are named.
7. Every owned path can be safely restored or discarded if the child fails.
8. A self-contained Task Packet contains all material facts and prohibitions.
9. Delegation has positive break-even.

Record break-even in one consistent unit, preferably minutes:

```text
expected benefit > packet preparation + supervision/review + likely recovery
```

Expected benefit must be strictly greater than the sum of all three costs. Missing,
incomparable, or materially uncertain estimates are not positive break-even;
choose `ROOT_DIRECT`.

Tiny changes, sequential judgment, external or destructive actions, work that
cannot be mechanically verified, and work requiring most of the Main Task
history stay with Root.

## Route-specific selection

After the all-required gate passes, select Luna only for one exact allowlisted
unit. Every other eligible bounded unit selects Terra.

### Luna allowlist

`LUNA_XHIGH_BACKGROUND` is allowed only for these actions:

- `READ_LOG_WINDOW`: read only the declared log path and declared time/line
  window; return timeline metrics or facts and exact evidence locations; make
  no writes and no broader judgment.
- `WRITE_UNIT_TESTS`: write only the declared test paths and explicit test
  names; make no production changes; report that the declared old and new
  tests pass.

No other action is Luna-eligible. An action that is eligible but not exactly on
this allowlist uses `TERRA_HIGH_BACKGROUND`.

### Terra execution

`TERRA_HIGH_BACKGROUND` handles every remaining eligible bounded execution
unit. It uses a fresh context and the fixed Terra tuple above.

There is at most one active child at a time. A child is never a Worker
delegator and may not create descendants.

## Receipts and boundaries

For every decision, Root emits only this concise commentary receipt:

```text
Auto Router: <decision>; reason: <short reason>
```

For a background decision, append the bounded responsibility and deterministic
verification target. A receipt is current-task commentary only: it is never
written to a file, sent to the Dashboard, or read as input to a later Route
Decision.

This Module does not add `src/router`, a classifier, registry, dependency,
LLM router, telemetry, Dashboard input/control, or any other executable route
artifact. Static tests can check this contract's shape; they cannot claim that
runtime routing is enforced.

## Failure behavior

Unsupported or rejected route parameters, a missing or uncertain child result,
an incomplete packet, or a failed gate means `ROOT_DIRECT` before delegation.

### Luna outcome

On Luna success, Luna ends. Root inspects, deterministically verifies, and
adopts only verified output.

On Luna failure or unverifiable output, Luna ends. Root must:

1. record the complete diff against the captured baseline;
2. independently verify every candidate change;
3. adopt only independently verified candidates;
4. restore every non-adopted owned path;
5. record the resolved post-Luna baseline;
6. optionally create exactly one fresh Terra child for remaining bounded work,
   using a packet that names the resolved baseline, explicit adoption and
   restoration decisions, every remnant, and that it contains no unverified
   Luna changes.

There is no second Luna attempt and no other fallback child.

### Terra outcome

Within the same session, Terra may receive its initial packet and at most two
focused repair follow-ups. A follow-up keeps the same child, model, effort,
execution surface, and fresh-context boundary; it does not replace or switch
the child. After the second focused repair, or any definite failure, Root
resolves every owned path and takes over.

No unresolved writable path may remain when child ownership ends. Root adopts
only verified output, restores all non-adopted output, runs final checks, and
delivers the result.
