# Worker Task Packet

The Task Packet is the routing Interface. It is not a second policy and never
selects a model. Root prepares one complete packet only after the canonical
[Runtime Router Policy](routing-policy.md) gate passes.

Missing material data makes the unit ineligible and therefore `ROOT_DIRECT`.
Every writable path is exclusive to the Worker while it is active; Root must
not edit it during that interval.

```markdown
# Worker identity

You are one bounded execution Worker. Do not create a child Agent, Worker,
background task, or thread.

## Route

- Route decision: ROOT_DIRECT | LUNA_XHIGH_BACKGROUND | TERRA_HIGH_BACKGROUND
- Selected native tuple: model / reasoning_effort / fork_turns
- Why this tuple is permitted by the canonical Policy:

## Objective

- Main objective:
- Bounded responsibility:
- Why this unit is independent:
- Fresh-context suitability evidence:

## Scope and ownership

- Read: exact paths or evidence windows:
- Write: exact Worker-owned paths only:
- Exact file ownership:
- Do not touch: exact paths, production areas, and external systems:
- Captured preflight baseline for every writable path:
- Repository safety check: no active merge/rebase conflict; no ownership ambiguity:

## Known facts and constraints

- Relevant facts and source pointers:
- User authorization and constraints:
- Upstream Skill requirements:
- Assumptions already confirmed by Root:
- Prohibitions and non-goals:

## Break-even record

- Unit: minutes (use one unit consistently):
- Expected benefit:
- Packet preparation cost:
- Supervision/review cost:
- Likely recovery cost:
- Total cost (sum of the three costs above):
- Strict comparison: expected benefit > packet preparation + supervision/review + likely recovery:
- Missing, incomparable, or materially uncertain estimate: yes/no

## Acceptance and verification

- Required result:
- Deterministic commands or output comparison:
- Expected verification results:
- Evidence to return, with exact file paths and line/output locations:

## Restore and handoff

- Safe restore/discard procedure for every owned path:
- Baseline to restore on failure:
- No unresolved writable paths at handoff:
- Return format: conclusion, evidence and exact changed files, verification result,
  remaining risks or missing information.
```

## Luna-only packet fields

For `LUNA_XHIGH_BACKGROUND`, Root must include exactly one allowlisted action:

- `READ_LOG_WINDOW`: the only declared log path, exact time/line window,
  timeline metrics/facts requested, exact evidence locations, and an explicit
  no-write/no-broader-judgment prohibition; or
- `WRITE_UNIT_TESTS`: only declared test paths, explicit test names, explicit
  no-production-change prohibition, and the declared old/new test command and
  expected pass result.

Any other action is not Luna-eligible and must use Terra or Root Direct.

## Terra-after-Luna packet fields

If Luna failed or was unverifiable and Root elects the one permitted fresh
Terra attempt, the packet must additionally state:

- complete diff against the captured pre-Luna baseline;
- each Luna candidate Root adopted and the independent evidence for adoption;
- each non-adopted path restored to baseline and its restoration evidence;
- the resolved post-Luna baseline for every remaining writable path;
- every remaining bounded remnant and its exact ownership;
- an explicit statement that no unverified Luna changes are present.

The Terra packet cannot conceal, broaden, or reinterpret unresolved Luna state.
If any of these fields is missing, Root takes over instead of delegating.
