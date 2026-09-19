# Runtime Capability Catalog

This Module reports what is requestable and enforceable. It enumerates
complete options; it never ranks their likely economic value.

## Evidence and freshness

~~~text
Evidence {
  class: OBSERVED | UNKNOWN,
  source_kind, source_ref, host_session_id, host_fingerprint,
  observed_at, valid_until, configuration_digest, value
}
CapabilityCatalog {
  host_session_id, host_fingerprint, generation, digest,
  models[], agents[], execution_templates[], skills[], mcps[], tools[],
  context_modes[], evidence[]
}
~~~

OBSERVED selectability means a trusted host surface accepts the requested
capability now. Application is a separate per-execution observation, never
inferred from requestability. UNKNOWN selectability excludes the option.

Evidence levels are explicit and never conflated:

| Level | Meaning | Example proof |
| --- | --- | --- |
| DISCOVERED | A file, name or listing exists | agent TOML present; MCP `tools/list` entry |
| REQUESTABLE | A trusted host surface accepts the capability now | loaded agent registry; native schema accepts the selector |
| ENFORCEABLE | Required sandbox/permission/scope enforcement is independently proven | observed policy enforcement, not profile text |
| APPLIED | Observed on one specific execution | requested-vs-observed record for that execution |

Catalog selectability requires at least REQUESTABLE plus every ENFORCEABLE
property the candidate claims; DISCOVERED alone never enters the candidate
set, and APPLIED never transfers across executions.

Read the actual native tool schema/model catalog, loaded agent registry and
effective configuration, policy/permission enforcement, tool availability and
continuation handles. File presence proves a file exists, not a loaded agent.
MCP tools/list proves discovery, not reliable permission/effect classification;
use trusted host grants and reviewed configuration for those properties.
Model provider identity is explicit; do not infer it from an ID prefix.

Cache discovery within the session keyed by host build, native schema, provider,
loaded profile/Skill/tool digests and effective policy configuration. Each
decision and pre-spawn check validates expiry and that fingerprint. Expired,
changed or unavailable evidence becomes UNKNOWN. Do not refresh by spawning
every model/effort tuple. Previous-session evidence is not current evidence.

A read-only integration probe establishes whether native invocation and trusted
evidence collection actually work. It does not certify every later application.
The first child instruction requires independently enforced confinement already
in place; a post-execution metadata comparison cannot establish past safety.

## Capability records

Models include provider ID, model ID, supported efforts and spawn selectability.
Agents include loaded profile ID/digest, model/effort constraints, configuration
precedence and enforced context/permission semantics. Tool, MCP and Skill
records include trusted content/configuration digest, grants and effect class.
Context records include fresh-context evidence or a live continuation binding.

An execution template is a host-validated configuration recipe with explicit
profile, safety/context settings and fixed capability grants. Its model/effort
slots enumerate observed supported values, not task-shape lane rules.
Parameterized paths resolve to the capsule's isolated workspace and declared
read dependencies. Profile defaults and live overrides are resolved with the
host's actual precedence, not assumptions about which TOML wins.

V1 selects model/effort/agent/context among these templates. Skill/MCP/tool
selection expands only after their grants are reliably controllable; until
then every candidate still declares all effective inherited capabilities.
Unsupported scope control is not represented by an empty list.

## Candidate construction

1. Require a concrete capsule, local authorization, baseline and compatible
   host evidence. Determine the single applicable qualification profile using
   frozen, disjoint predicates over measured traits; overlap/unknown -> Root.
2. Enumerate every supported template/model/effort/context combination.
   Fresh has no worker handle. Continuation is enumerated only with all proofs.
3. Resolve every field, including inherited profile settings, provider, Skills,
   MCPs, tools, sandbox, network and filesystem grants.
4. Apply deterministic compatibility, authorization, safety, budget and
   production-qualification predicates (research uses its explicit manifest).
   Record each exclusion's stable rule/reason. These predicates admit or deny;
   they never pick the cheapest, strongest or highest-probability option.
5. Deduplicate byte-equivalent resolved contracts, sort by stable candidate ID
   solely for serialization, add the Root candidate, and hash the snapshot.
   Sorting is not ranking and cannot omit a candidate.

There is no top-K, hard-coded model lane or Root-recommended shortlist.
Exceeding 255 options, token limits or a frozen qualified candidate-family
coverage condition closes routing; never take the first N. Root is always an
option. If it is the only eligible option, lifecycle takes Root without an
unnecessary provider call and records PREFLIGHT_NO_DELEGATE.

## Effective scope

Required arrays specify the entire effective grant set. Empty means none;
missing is invalid. A requested narrow tool list that the host cannot enforce
is not selectable. Instructions to avoid a tool are not scope enforcement.
Workers cannot write to shared state, contact external recipients, publish,
push, deploy, mutate external systems or spawn descendants. Read-only network
access is explicit, scoped and observed; absent permission means disabled.

## Qualification versus freshness

The exact snapshot digest binds one decision. Qualification binds semantic
host capabilities, template families and construction/projection rules, not
timestamps or task-specific absolute paths. Fresh timestamps alone do not
invalidate qualification; semantic configuration changes do. No quota,
account balance, ccusage, credit estimate, model mix or latency history enters
this Module or candidate descriptions.
