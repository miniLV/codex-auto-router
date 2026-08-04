# Gate delegation with a template, not a cost estimate

Status: Accepted.

## Decision

Delegation is gated by a specification template that must be filled concretely,
plus three mechanical checks. No cost, size, or work-reduction estimate gates
delegation.

"Filled concretely" is defined so it is not itself a judgment call:

1. Every entry under `FILES AND OWNERSHIP` is a literal path that exists or is
   explicitly marked new; no globs, no catch-all directories; the set is pairwise
   non-overlapping.
2. Every `Run:` command has already been executed by Root before dispatch, with
   its actual result recorded. A section with no executable command blocks the
   dispatch.
3. The repository is clean and a baseline exists for every writable path.

`INTERFACES` and `CONSTRAINTS` must contain named concrete items or the literal
word `none`, so vagueness cannot satisfy "filled".

## Why the cost estimate was dropped

Earlier revisions required a seven-term "Expected Sol Work Reduction" record, then
a one-line version of the same idea. Both were unmeasurable before the work was
done, so either would be skipped or rationalised in whichever direction the model
already preferred. Removing it makes the gate purely mechanical, which means it
cannot be argued around.

Delegating a trivial unit wastes a round trip. It cannot damage the repository,
because the baseline and restore rules are independent of any cost judgment. Waste
is also observable, so a floor can be added later from real data instead of a
guess. The most useful signal to collect is how often Root, after reading a
child's diff, concludes it would have been faster to write it directly.

## Why pre-executing verification is the load-bearing check

It converts "is this concrete?" into "run it". It exposes commands that do not
exist, replaces "Success: it passes" with real output, and captures the
behavioural before-state at no extra cost, complementing the file baseline.
