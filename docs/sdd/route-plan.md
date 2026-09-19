# RouteRequest / RoutePlan

Normalized internal schemas. These are repository-owned types; the Jev wire
schema never leaks past the adapter (see jev-adapter.md).

## RouteRequest

```text
RouteRequest:
  task_capsule:                        TaskCapsule
  capability_catalog:                  CapabilityCatalog (+ digest)
  attempt_state:                       { attempt_index, execution_index,
                                         economic_cap, hard_cap }
  previous_failure_evidence?:          structured failure record (if retry)
  benchmark_qualification_context:     profile qualification snapshot
```

## RoutePlan

```text
RoutePlan:
  decision:            "root" | "delegate"
  model                (must exist in catalog)
  reasoning_effort     (must be supported by the model entry)
  agent                (profile id from catalog, optional)
  skills[]             (catalog ids)
  mcps[]               (catalog ids)
  tools[]              (catalog ids)
  context_mode         "fresh" | "continuation"
  continuation_target? (only if context_mode = continuation and runtime
                        provably supports it)
  confidence           (from Jev)
  risk                 (class)
  benefit_class        (class, not an invented dollar/token forecast)
  reason_codes[]       (stable identifiers for the receipt)
```

## Rules

1. Every capability field must resolve to a catalog entry. `UNKNOWN`
   capability evidence ⇒ invalid plan ⇒ Guard `DENY`.
2. `decision: root` is a valid, first-class RoutePlan. It means Root executes
   with the capsule's verification discipline — no child.
3. Continuation may be selected **only** for a target whose runtime identity
   and handle are observable (see delivery-lifecycle.md §continuation);
   otherwise continuation is simply absent from the catalog and cannot be
   selected.
4. No exact cost fields. Classes and calibrated probabilities only. The
   adapter/Guard reject any plan carrying fabricated precise savings.
5. Benefit class reflects benchmark-qualified economics for the task profile;
   it is an input to Guard qualification checks, not a runtime forecast.
