# Codex Auto Router Architecture

The repository ships a static contract, not an executable router engine. The
[Runtime Router Policy](../skills/codex-auto-router/references/routing-policy.md)
is the sole source of routing rules.

## Deep-module boundaries

- **Module:** `references/routing-policy.md` owns the whole contract —
  eligibility, the fixed channel tuples, the dispatch template, verification,
  review triggering, and failure behavior.
- **Interface:** the five-section dispatch template and its return fields, in
  section 3 of the Policy.
- **Seam:** native child invocation via the spawn surface, with model, effort,
  and `fork_turns` supplied per spawn.
- **Adapters:** `SKILL.md`, `agents/openai.yaml`, and the optional reviewer
  profile with its installer expose or support the Policy without selecting
  routes or copying its state machine.

Earlier revisions split the Interface and Seam into separate reference files;
both were absorbed into the Policy. See `docs/adr/0011` and `docs/adr/0012`.

## Runtime compatibility

If another routing or orchestration authority governs the current task, this
Skill stands down to `ROOT_DIRECT`. Dashboard, `ccusage`, `src/credit.ts`, and
any Credit or usage estimate are independent observers or product
implementation. Their history, labels, model mix, latency, and estimates never
influence a routing decision.

Background routing also requires trusted current-task evidence for `gpt-6-astra`
at Medium reasoning or higher. The Skill never changes the Root tuple; any
other or unverified Root stays `ROOT_DIRECT`.

## Delivery lifecycle

Each Main Task allows at most five dispatches: the original child and up to four
corrected retries from the restored baseline. Every writable path gets a
baseline before dispatch, and restore is the primary recovery from a bad result.

Root verifies every delegated result mechanically — it reads the complete diff
and reruns the verification commands the child's owned paths could affect,
reusing the pre-dispatch results for the rest. A `gpt-6-astra` / `medium`
fresh-context reviewer is dispatched only when the Policy's risk triggers fire.
Each candidate gets at most one review and a Main Task gets at most five; it
judges both the diff and whether the specification itself was adequate, and
returns exactly `ACCEPT`, `REVISE`, or `RECONSIDER`.

Exactly one child runs at a time, no child may delegate, and reviewer and
worker never run concurrently. Every failure path resolves to `ROOT_DIRECT`.

## Validation and proof

`npm test`, `npm run typecheck`, and `git diff --check` validate the static
contract. Static validation proves the contract's shape and wording, not that
any runtime dispatch, verification, or review actually executed; runtime
evidence comes only from real platform invocations observed by Root.
