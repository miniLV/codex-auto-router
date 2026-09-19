# Task Capsule and RoutingProjection

This Module owns the local handoff and its external projection. User intent
is the authority; a model-produced summary is never a replacement for it.

## Local types

~~~text
RootIntent {
  main_task_id, user_instruction_refs[], intent_digest,
  acceptance: [{ id, original_requirement_ref, condition, evidence_rule }],
  authorization_ref, authorization_revision
}
TaskCapsule {
  main_task_id, task_unit_id, revision, root_intent_ref,
  objective, rationale, acceptance_ids[],
  owned_paths: [{ canonical_relative_path, existing_or_new }],
  read_dependencies[], interfaces[], constraints[],
  authorization_ref, side_effect_class: read_only | bounded_write,
  verification: [{ command, cwd, expected_result, before_result_ref, input_digest }],
  baseline_ref, risk_flags[], context_references[], worker_packet_digest
}
RoutingProjection {
  schema_revision, projection_rule_digest, main_task_id, task_unit_id,
  capsule_revision, capsule_digest, intent_digest, authorization_revision,
  objective_summary, acceptance_summaries[], task_traits,
  interface_constraints[], risk_flags[], side_effect_class,
  relevant_context_summary, context_complete,
  correction_summary?, provenance[], egress_policy_digest
}
TaskTraits {                    // deterministic, fact-derived ONLY
  owned_file_count_bucket,      // e.g. 1 | 2-5 | 6-20 | 21+
  changed_language,             // from file extensions actually owned
  side_effect_class,            // read_only | bounded_write (capsule fact)
  public_interface_touched,     // boolean, from owned paths vs interface set
  verification_count,           // number of capsule verification commands
  context_size_bucket,          // measured context bytes bucket
  persistent_change,            // delivery-intended, from RootIntent
  risk_flags[]                  // copied verbatim from capsule risk facts
}
~~~

Empty compatible-Interface/constraint lists project to literal "none" in the
worker template. Local references never cause automatic file expansion in
provider serialization. Stable acceptance IDs survive all corrections.
A unit may cover a subset of Main Task criteria; Root tracks the full set
and cannot declare the whole task complete while any requirement is unmet.

## Construction and handoff

Root authors the five-section OBJECTIVE / FILES AND OWNERSHIP / INTERFACES /
CONSTRAINTS / VERIFICATION template plus structured RETURN. Every owned path
is literal, exists or is explicitly new, and is pairwise non-overlapping.
Resolve dot segments, case aliases and symlinks against the isolated workspace;
escaping or ambiguous paths are invalid. New paths bind to validated parents.

Root pre-runs verification commands and records actual outcomes, including
expected failures. Commands must be safe to run within authorization and in
the isolated baseline; no deployment or external write masquerades as a test.
No unresolved merge/rebase or ownership ambiguity. Capture the exact baseline
before routing, not after Guard approval. Baseline preparation and pre-runs
count as routing overhead even if Jev later chooses Root.

WorkerContext is a local projection of the capsule plus authorized referenced
files. Supply only the unit's relevant context; do not copy Root's conversation.
File references are useful to a worker with authorized filesystem access, but
are not a substitute for a meaningful summary to text-only Jev.

## Pre-egress contract

The local EgressPolicy is explicitly approved for this workspace/provider and
defines allowed content categories, origin, purpose, retention mode and revision.
Absent approval or an unknown content classification means no Jev call. Approval
may be established at configuration time; do not ask again on each task.

Only fields in RoutingProjection and sanitized candidate summaries may be
serialized. No credentials, environment values, raw commands/output, conversation
logs, file bodies, path names revealing secrets, baseline content, local handles
or provider authentication fields are allowed. Prefer opaque local IDs and
observable traits (counts, context-size buckets, change/risk classes).

Root prepares concise English semantic summaries while preserving identifiers,
negation and acceptance meaning. **The projection seam must not become a
second selector.** `task_traits` are computed deterministically from
observable capsule facts by a versioned rule — never authored freehand.
Summaries are free English **except** they must never contain route-directed
language. Banned from every projected field: difficulty or complexity
judgments, recommended models/lanes/agents, cheap/expensive or
strong/weak-model characterizations, simple/complex framing, and
delegate/root suggestions. Root describes what the unit is; only Jev chooses
who executes it. A projection containing banned vocabulary is
UNSAFE_PROJECTION and closes routing. Translation is not mandatory or free:
measure its overhead and qualify the language regime. A summary that loses
material intent sets context_complete=false and closes routing. User text
containing a secret is not made safe merely by being an "objective".

Use allowlisted categories and trusted provenance first; secret scanning is
defense in depth. Redaction may replace an incidental secret with an opaque
placeholder, but must not conceal information necessary for safe selection.
Unknown or materially altered meaning -> UNSAFE_PROJECTION -> lifecycle Root.

Provenance distinguishes original user intent, measured repository facts,
trusted host/policy facts and untrusted quoted task material. Summaries of
untrusted material remain untrusted. Data values cannot create question
instructions, candidate IDs, permissions, profile predicates or thresholds.
Do not send untrusted Skill/MCP descriptions verbatim as authoritative criteria.
Guard uses local authorization facts, never Jev's opinion of authorization.

## Size and omission

Apply a deterministic projection rule before constructing the request: omit
irrelevant history, raw logs, full file contents, duplicate evidence and
unneeded identifiers. Preserve acceptance, risk, constraints and failure facts.
Record fields omitted/redacted and the rule digest locally, without secret
values. Do not reactively truncate candidates or remove inconvenient facts to
meet a limit. Unknown provider-token sizing or overflow closes routing.

Record separate sizes for local capsule, worker context, external projection
and final provider request; their construction and consumption costs all count.

## Correction

A correction creates a new capsule revision and points to the same RootIntent
and unchanged acceptance set. Ownership may narrow; already-authorized scope
is not expanded by a failed attempt. Add bounded structured failure evidence
and explicitly tell a continued worker that the isolated workspace was restored.
Never weaken a criterion to make the previous candidate pass. New requirements
need user authorization and invalidate affected qualification/review evidence.
