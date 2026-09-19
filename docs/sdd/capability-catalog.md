# Runtime Capability Catalog

The catalog is the truthful inventory of what the runtime can actually do
**right now**. Jev may select only entries present in the catalog; a RoutePlan
referencing an absent or invented capability is invalid and the Guard denies it.

## Why

Routing into a capability the runtime cannot honor produces either failed
execution or silently substituted execution — both are contract violations.
Discovery is a **runtime fact**, not a doc claim: the catalog is built by
probing the host, and every entry carries its evidence class.

## Candidate structure

```text
models:        { id, supported_reasoning_efforts[], availability: observed, spawn_support }
agents:        { profile_id, model_constraints, sandbox, permissions, continuation }
skills:        { id, scope }
mcps:          { id, permissions, effect_class: read | write | external_action }
tools:         { id, permission_class }
context_modes: { fresh, continuation, fork_options[] }
```

`effect_class` and `permission_class` are what the Guard reads to check
least-privilege and unauthorized-side-effect rules.

## Discovery requirements

- Catalog entries MUST come from observed runtime state (spawn surface
  parameters, agent registry, MCP `tools/list`, sandbox policy types), each
  tagged with evidence class `OBSERVED` or `UNKNOWN`.
- Catalog construction is idempotent per attempt and cheap: discovery failures
  simply omit capabilities; they never fabricate them.
- The catalog digest is part of the Decision Receipt so any route is
  reproducible against the exact capability set it was selected from.

## Freshness rules

- The catalog is rebuilt (or freshness-validated) at the start of each routing
  decision. Stale catalogs produce `UNKNOWN` capability evidence, which the
  Guard treats as unavailable — never as present.
- A capability observed in a previous session confers nothing; stateless
  sessions cannot inherit prior catalogs.

## What the catalog does NOT contain

- Quota, account balance, ccusage data, credit estimates, model mix, latency
  history — these are observers, never routing inputs.
- Anything the host cannot prove: an unsupported "would-be" capability.
