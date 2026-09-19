import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, posix, relative, resolve, win32 } from "node:path";
import { canonicalJson, digest } from "./canonical.js";

export type SideEffectClass = "read_only" | "bounded_write";
export type ExistingOrNew = "existing" | "new";

export interface AcceptanceCriterion {
  id: string;
  original_requirement_ref: string;
  condition: string;
  evidence_rule: string;
}

export interface RootIntent {
  main_task_id: string;
  user_instruction_refs: string[];
  intent_digest: string;
  acceptance: AcceptanceCriterion[];
  authorization_ref: string;
  authorization_revision: string | number;
}

export interface OwnedPath {
  canonical_relative_path: string;
  existing_or_new: ExistingOrNew;
}

export interface VerificationCommand {
  /** An argv vector. It is never interpreted through a shell here. */
  command: string[];
  cwd: string;
  expected_result: string;
  before_result_ref: string;
  input_digest: string;
}

export interface TaskCapsule {
  main_task_id: string;
  task_unit_id: string;
  revision: number;
  root_intent_ref: string;
  objective: string;
  rationale: string;
  acceptance_ids: string[];
  owned_paths: OwnedPath[];
  read_dependencies: string[];
  interfaces: string[];
  constraints: string[];
  authorization_ref: string;
  side_effect_class: SideEffectClass;
  verification: VerificationCommand[];
  baseline_ref: string;
  risk_flags: string[];
  context_references: string[];
  worker_packet_digest: string;
}

export type OwnedFileCountBucket = "1" | "2-5" | "6-20" | "21+";
export type ContextSizeBucket = "0" | "1-4KiB" | "4-16KiB" | "16-32KiB" | "32KiB+";

export interface TaskTraits {
  owned_file_count_bucket: OwnedFileCountBucket;
  changed_language: string[];
  side_effect_class: SideEffectClass;
  public_interface_touched: boolean;
  verification_count: number;
  context_size_bucket: ContextSizeBucket;
  persistent_change: boolean;
  risk_flags: string[];
}

export interface TraitEvidence {
  context_bytes: number;
  persistent_change: boolean;
}

export interface TrustedAuthorizationEvidence {
  authorization_ref: string;
  authorization_revision: string | number;
  side_effect_class: SideEffectClass;
  /** Exact paths authorized for this capsule's owned scope. */
  exact_paths: string[];
}

export interface TrustedBaselineEvidence {
  baseline_ref: string;
  /** Required local record of the paths captured by this baseline. */
  exact_paths: string[];
}

export interface TrustedCapsuleEvidence {
  /** An isolated workspace root selected by Root/host state, not by the capsule. */
  workspace_root: string;
  /** Required binding to the exact RootIntent digest used for this capsule. */
  root_intent_ref: string;
  authorization: TrustedAuthorizationEvidence;
  baseline: TrustedBaselineEvidence;
  /** These references prove Root pre-ran every command, pairwise by verification index. */
  verification_result_refs: string[];
  /** These are trusted pre-run input digests, pairwise by verification index. */
  verification_input_digests: string[];
}

export type CapsuleRejectionCode =
  | "INVALID_ROOT_INTENT"
  | "INVALID_CAPSULE"
  | "INVALID_PATH"
  | "PATH_ESCAPE"
  | "PATH_ALIAS"
  | "PATH_OVERLAP"
  | "AUTHORIZATION_MISMATCH"
  | "BASELINE_MISSING"
  | "VERIFICATION_INVALID"
  | "CORRECTION_EXPANDS_SCOPE";

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
  utf8_bytes: number;
}

export interface ValidationFailure {
  ok: false;
  routing: "CLOSED";
  code: CapsuleRejectionCode;
  issues: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export type SummaryField =
  | "objective_summary"
  | "acceptance_summaries"
  | "interface_constraints"
  | "risk_flags"
  | "relevant_context_summary"
  | "correction_summary";

/** A Root-supplied statement about authored summary provenance, not host trust. */
export interface SummaryAttestation {
  field: SummaryField | "all";
  provenance_ref: string;
  attested_by: "root";
  classification: "root_authored" | "measured_repository_fact" | "trusted_host_policy_fact" | "untrusted_quoted_task_material";
  route_directed: boolean;
  meaning_preserved: boolean;
}

export type ProvenanceKind = SummaryAttestation["classification"];
export type EgressContentCategory =
  | "task_summary"
  | "acceptance_summary"
  | "interface_constraints"
  | "risk_facts"
  | "task_traits"
  | "context_summary"
  | "provenance"
  | "untrusted_quoted_task_material";

export interface ProvenanceEntry {
  kind: ProvenanceKind;
  ref: string;
  content_category: EgressContentCategory;
  authority: "fact" | "data";
}

/** Host/policy evidence. It is not interchangeable with SummaryAttestation. */
export interface EgressPolicyApproval {
  approved: true;
  provider_id: string;
  approval_ref: string;
  policy_digest: string;
  purpose: string;
  allowed_content_categories: EgressContentCategory[];
}

export interface AcceptanceSummary {
  id: string;
  summary: string;
}

export interface ProjectionAuthoringInput {
  objective_summary: string;
  acceptance_summaries: AcceptanceSummary[];
  interface_constraints: string[];
  relevant_context_summary: string;
  correction_summary?: string;
  context_complete: boolean;
  context_bytes: number;
  persistent_change: boolean;
  provenance: ProvenanceEntry[];
  summary_attestations: SummaryAttestation[];
  egress_policy: EgressPolicyApproval;
}

export interface RoutingProjection {
  schema_revision: string;
  projection_rule_digest: string;
  main_task_id: string;
  task_unit_id: string;
  capsule_revision: number;
  capsule_digest: string;
  intent_digest: string;
  authorization_revision: string | number;
  objective_summary: string;
  acceptance_summaries: AcceptanceSummary[];
  task_traits: TaskTraits;
  interface_constraints: string[];
  risk_flags: string[];
  side_effect_class: SideEffectClass;
  relevant_context_summary: string;
  context_complete: boolean;
  correction_summary?: string;
  provenance: ProvenanceEntry[];
  egress_policy_digest: string;
}

export interface WorkerReturnTemplate {
  STATUS: "required";
  CHANGES: string;
  VERIFIED: string;
  "JUDGMENT CALLS": string;
  GAPS: string;
}

export interface WorkerPacket {
  OBJECTIVE: string;
  "FILES AND OWNERSHIP": {
    owned_paths: OwnedPath[];
    read_dependencies: string[];
    context_references: string[];
  };
  INTERFACES: string[] | "none";
  CONSTRAINTS: string[] | "none";
  VERIFICATION: VerificationCommand[];
  RETURN: WorkerReturnTemplate;
}

export type ProjectionRejectionCode =
  | "UNSAFE_PROJECTION"
  | "INCOMPLETE_SUMMARY"
  | "EGRESS_NOT_APPROVED"
  | "INVALID_PROVENANCE";

export interface ProjectionSuccess<T> {
  ok: true;
  value: T;
  utf8_bytes: number;
}

export interface ProjectionFailure {
  ok: false;
  routing: "CLOSED";
  code: ProjectionRejectionCode;
  issues: string[];
}

export type ProjectionResult<T> = ProjectionSuccess<T> | ProjectionFailure;

const PROJECTION_SCHEMA_REVISION = "task-capsule/1";
const PROJECTION_RULE_DIGEST = digest({ name: "task-capsule-projection", revision: 1, allowlist: [
  "objective_summary", "acceptance_summaries", "task_traits", "interface_constraints",
  "risk_flags", "side_effect_class", "relevant_context_summary", "context_complete",
  "correction_summary", "provenance", "egress_policy_digest"
] });

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[\u0000\r\n]/.test(value);
}

function stringArray(value: unknown, field: string, issues: string[]): value is string[] {
  if (!Array.isArray(value) || value.some((item) => !nonEmptyString(item))) {
    issues.push(`${field} must be a non-empty string array`);
    return false;
  }
  return true;
}

function refString(value: unknown, field: string, issues: string[]): boolean {
  if (!nonEmptyString(value) || value.length > 1024) {
    issues.push(`${field} must be a bounded reference string`);
    return false;
  }
  return true;
}

function isRevision(value: unknown): value is string | number {
  return (typeof value === "string" && nonEmptyString(value)) || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function invalid<T>(code: CapsuleRejectionCode, issues: string[]): ValidationResult<T> {
  return { ok: false, routing: "CLOSED", code, issues: [...new Set(issues)] };
}

function projectionInvalid<T>(code: ProjectionRejectionCode, issues: string[]): ProjectionResult<T> {
  return { ok: false, routing: "CLOSED", code, issues: [...new Set(issues)] };
}

function capsuleRecord(capsule: TaskCapsule): Record<string, unknown> {
  return {
    main_task_id: capsule.main_task_id,
    task_unit_id: capsule.task_unit_id,
    revision: capsule.revision,
    root_intent_ref: capsule.root_intent_ref,
    objective: capsule.objective,
    rationale: capsule.rationale,
    acceptance_ids: [...capsule.acceptance_ids],
    owned_paths: capsule.owned_paths.map((path) => ({ canonical_relative_path: path.canonical_relative_path, existing_or_new: path.existing_or_new })),
    read_dependencies: [...capsule.read_dependencies],
    interfaces: [...capsule.interfaces],
    constraints: [...capsule.constraints],
    authorization_ref: capsule.authorization_ref,
    side_effect_class: capsule.side_effect_class,
    verification: capsule.verification.map((verification) => ({
      command: [...verification.command],
      cwd: verification.cwd,
      expected_result: verification.expected_result,
      before_result_ref: verification.before_result_ref,
      input_digest: verification.input_digest
    })),
    baseline_ref: capsule.baseline_ref,
    risk_flags: [...capsule.risk_flags],
    context_references: [...capsule.context_references],
    worker_packet_digest: capsule.worker_packet_digest
  };
}

function intentRecord(intent: RootIntent): Record<string, unknown> {
  return {
    main_task_id: intent.main_task_id,
    user_instruction_refs: [...intent.user_instruction_refs],
    intent_digest: intent.intent_digest,
    acceptance: intent.acceptance.map((criterion) => ({
      id: criterion.id,
      original_requirement_ref: criterion.original_requirement_ref,
      condition: criterion.condition,
      evidence_rule: criterion.evidence_rule
    })),
    authorization_ref: intent.authorization_ref,
    authorization_revision: intent.authorization_revision
  };
}

export function validateRootIntent(value: unknown): ValidationResult<RootIntent> {
  const input = record(value);
  const issues: string[] = [];
  if (!input) return invalid("INVALID_ROOT_INTENT", ["RootIntent must be an object"]);
  if (!nonEmptyString(input.main_task_id)) issues.push("main_task_id is required");
  if (!stringArray(input.user_instruction_refs, "user_instruction_refs", issues) || input.user_instruction_refs.length === 0) issues.push("at least one user instruction reference is required");
  if (!nonEmptyString(input.intent_digest)) issues.push("intent_digest is required");
  if (!Array.isArray(input.acceptance) || input.acceptance.length === 0) {
    issues.push("acceptance must contain at least one criterion");
  }
  const acceptance: AcceptanceCriterion[] = [];
  const acceptanceIds = new Set<string>();
  if (Array.isArray(input.acceptance)) {
    for (const [index, raw] of input.acceptance.entries()) {
      const item = record(raw);
      if (!item || !nonEmptyString(item.id) || !nonEmptyString(item.original_requirement_ref) || !nonEmptyString(item.condition) || !nonEmptyString(item.evidence_rule)) {
        issues.push(`acceptance[${index}] is incomplete`);
        continue;
      }
      if (acceptanceIds.has(item.id)) issues.push(`acceptance id ${item.id} is duplicated`);
      acceptanceIds.add(item.id);
      acceptance.push({ id: item.id, original_requirement_ref: item.original_requirement_ref, condition: item.condition, evidence_rule: item.evidence_rule });
    }
  }
  if (!nonEmptyString(input.authorization_ref)) issues.push("authorization_ref is required");
  if (!isRevision(input.authorization_revision)) issues.push("authorization_revision is invalid");
  if (issues.length > 0) return invalid("INVALID_ROOT_INTENT", issues);
  const intent: RootIntent = {
    main_task_id: input.main_task_id as string,
    user_instruction_refs: [...input.user_instruction_refs as string[]],
    intent_digest: input.intent_digest as string,
    acceptance,
    authorization_ref: input.authorization_ref as string,
    authorization_revision: input.authorization_revision as string | number
  };
  return { ok: true, value: intent, utf8_bytes: utf8ByteSize(intentRecord(intent)) };
}

function canonicalLiteralPath(value: unknown, field: string, issues: string[]): value is string {
  if (!nonEmptyString(value) || value.length > 4096 || isAbsolute(value) || win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes("\\") || value.includes("\u0000")) {
    issues.push(`${field} must be a relative POSIX path`);
    return false;
  }
  if (value === "." || value.endsWith("/") || value.includes("//") || posix.normalize(value) !== value) {
    issues.push(`${field} must be canonical and contain no dot segments`);
    return false;
  }
  if (value.split("/").some((part) => part.length === 0 || part === "." || part === ".." || /[*?\[\]{}]/.test(part))) {
    issues.push(`${field} must name one literal file, not a directory or glob`);
    return false;
  }
  return true;
}

function lower(value: string): string {
  return value.toLocaleLowerCase("en-US");
}

function contained(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate);
  return remainder === "" || (remainder !== ".." && !remainder.startsWith(`..${posix.sep}`) && !isAbsolute(remainder));
}

interface ResolvedPath {
  input: string;
  resolved: string;
  existed: boolean;
}

function exactCasePath(root: string, pathValue: string, allowMissingFinal: boolean): ResolvedPath {
  let current = root;
  const parts = pathValue.split("/");
  for (const [index, part] of parts.entries()) {
    let names: string[];
    try {
      names = readdirSync(current);
    } catch {
      throw new Error(`cannot read parent of ${pathValue}`);
    }
    const exact = names.filter((name) => name === part);
    const aliases = names.filter((name) => lower(name) === lower(part));
    const isFinal = index === parts.length - 1;
    if (exact.length === 0) {
      if (aliases.length > 0) throw new Error(`case alias for ${pathValue}`);
      if (isFinal && allowMissingFinal) {
        const parent = realpathSync(current);
        if (!contained(root, parent) || !statSync(parent).isDirectory()) throw new Error(`new path parent escapes workspace: ${pathValue}`);
        return { input: pathValue, resolved: resolve(current, part), existed: false };
      }
      throw new Error(`path does not exist: ${pathValue}`);
    }
    if (aliases.length !== 1) throw new Error(`ambiguous case alias for ${pathValue}`);
    current = resolve(current, exact[0]);
  }
  const resolved = realpathSync(current);
  if (!contained(root, resolved)) throw new Error(`symlink escapes workspace: ${pathValue}`);
  return { input: pathValue, resolved, existed: true };
}

function checkFilePath(root: string, pathValue: string, expected: ExistingOrNew): ResolvedPath {
  const resolved = exactCasePath(root, pathValue, expected === "new");
  if (expected === "new") {
    if (resolved.existed) throw new Error(`new path already exists: ${pathValue}`);
    return resolved;
  }
  if (!resolved.existed) throw new Error(`existing path is missing: ${pathValue}`);
  if (!statSync(resolved.resolved).isFile()) throw new Error(`owned path is not a regular file: ${pathValue}`);
  return resolved;
}

function workspaceRoot(value: string): string {
  const root = realpathSync(value);
  if (!statSync(root).isDirectory()) throw new Error("workspace_root must be a directory");
  return root;
}

function validatePaths(capsule: TaskCapsule, evidence: TrustedCapsuleEvidence, issues: string[]): void {
  let root: string;
  try { root = workspaceRoot(evidence.workspace_root); } catch (error) {
    issues.push(error instanceof Error ? error.message : "workspace_root is invalid");
    return;
  }
  const seenRaw = new Set<string>();
  const seenResolved = new Set<string>();
  for (const [index, owned] of capsule.owned_paths.entries()) {
    if (!owned || !canonicalLiteralPath(owned.canonical_relative_path, `owned_paths[${index}].canonical_relative_path`, issues) || (owned.existing_or_new !== "existing" && owned.existing_or_new !== "new")) {
      if (owned && owned.existing_or_new !== "existing" && owned.existing_or_new !== "new") issues.push(`owned_paths[${index}].existing_or_new is invalid`);
      continue;
    }
    const pathValue = owned.canonical_relative_path;
    const rawKey = lower(pathValue);
    if (seenRaw.has(rawKey)) issues.push(`owned path is duplicated or a case alias: ${pathValue}`);
    seenRaw.add(rawKey);
    try {
      const resolved = checkFilePath(root, pathValue, owned.existing_or_new);
      const resolvedKey = lower(relative(root, resolved.resolved));
      if (seenResolved.has(resolvedKey)) issues.push(`owned path resolves to an already-owned file: ${pathValue}`);
      seenResolved.add(resolvedKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "owned path is invalid";
      issues.push(message.includes("escape") ? message : message.includes("alias") ? message : message);
    }
  }
  const ownedPaths = capsule.owned_paths.map((path) => path.canonical_relative_path).filter((path): path is string => typeof path === "string");
  for (let left = 0; left < ownedPaths.length; left += 1) {
    for (let right = left + 1; right < ownedPaths.length; right += 1) {
      const a = ownedPaths[left].split("/");
      const b = ownedPaths[right].split("/");
      const prefix = (shorter: string[], longer: string[]) => shorter.length < longer.length && shorter.every((part, index) => lower(part) === lower(longer[index]));
      if (prefix(a, b) || prefix(b, a)) issues.push(`owned paths overlap: ${ownedPaths[left]} and ${ownedPaths[right]}`);
    }
  }
  const seenDependencies = new Set<string>();
  for (const [index, dependency] of capsule.read_dependencies.entries()) {
    if (!canonicalLiteralPath(dependency, `read_dependencies[${index}]`, issues)) continue;
    const key = lower(dependency);
    if (seenDependencies.has(key)) issues.push(`read dependency is duplicated or a case alias: ${dependency}`);
    seenDependencies.add(key);
    try {
      const resolved = exactCasePath(root, dependency, false);
      if (!statSync(resolved.resolved).isFile()) issues.push(`read dependency is not a regular file: ${dependency}`);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : `read dependency is invalid: ${dependency}`);
    }
  }
  for (const [index, verification] of capsule.verification.entries()) {
    if (!nonEmptyString(verification.cwd)) {
      issues.push(`verification[${index}].cwd is required`);
      continue;
    }
    if (verification.cwd !== "." && !canonicalLiteralPath(verification.cwd, `verification[${index}].cwd`, issues)) continue;
    try {
      const cwd = verification.cwd === "." ? root : exactCasePath(root, verification.cwd, false).resolved;
      if (!statSync(cwd).isDirectory()) issues.push(`verification[${index}].cwd is not a directory`);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : `verification[${index}].cwd is invalid`);
    }
  }
}

function validateAuthorization(capsule: TaskCapsule, intent: RootIntent, evidence: TrustedCapsuleEvidence, issues: string[]): void {
  const authorization = evidence.authorization;
  if (!authorization || authorization.authorization_ref !== capsule.authorization_ref || authorization.authorization_ref !== intent.authorization_ref || authorization.authorization_revision !== intent.authorization_revision || authorization.side_effect_class !== capsule.side_effect_class) {
    issues.push("authorization does not bind the capsule, intent, revision, and side-effect class");
    return;
  }
  const authorized = authorization.exact_paths.map((path) => path).sort();
  const owned = capsule.owned_paths.map((path) => path.canonical_relative_path).sort();
  if (JSON.stringify(authorized) !== JSON.stringify(owned)) issues.push("authorization paths must exactly equal owned paths");
}

function validateVerification(capsule: TaskCapsule, evidence: TrustedCapsuleEvidence, issues: string[]): void {
  if (capsule.verification.length === 0) issues.push("at least one pre-run verification command is required");
  if (!Array.isArray(evidence.verification_result_refs) || evidence.verification_result_refs.length !== capsule.verification.length) issues.push("trusted verification result references must align one-to-one with verification commands");
  if (!Array.isArray(evidence.verification_input_digests) || evidence.verification_input_digests.length !== capsule.verification.length) issues.push("trusted verification input digests must align one-to-one with verification commands");
  for (const [index, verification] of capsule.verification.entries()) {
    if (!Array.isArray(verification.command) || verification.command.length === 0 || verification.command.some((argument) => !nonEmptyString(argument))) issues.push(`verification[${index}].command must be an argv array`);
    if (!nonEmptyString(verification.expected_result)) issues.push(`verification[${index}].expected_result is required`);
    if (!nonEmptyString(verification.before_result_ref)) issues.push(`verification[${index}].before_result_ref is required`);
    if (!/^[a-f0-9]{64}$/i.test(verification.input_digest)) issues.push(`verification[${index}].input_digest must be a SHA-256 digest`);
    if (!Array.isArray(evidence.verification_result_refs) || evidence.verification_result_refs[index] !== verification.before_result_ref) issues.push(`verification[${index}] is not bound to its trusted pre-run result reference`);
    if (!Array.isArray(evidence.verification_input_digests) || evidence.verification_input_digests[index] !== verification.input_digest) issues.push(`verification[${index}] is not bound to its trusted pre-run input digest`);
  }
}

function readCapsule(value: unknown, issues: string[]): TaskCapsule | undefined {
  const input = record(value);
  if (!input) {
    issues.push("TaskCapsule must be an object");
    return undefined;
  }
  const requiredStrings = ["main_task_id", "task_unit_id", "root_intent_ref", "objective", "rationale", "authorization_ref", "baseline_ref", "worker_packet_digest"];
  for (const field of requiredStrings) if (!nonEmptyString(input[field])) issues.push(`${field} is required`);
  if (typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 0) issues.push("revision must be a non-negative safe integer");
  if (!Array.isArray(input.acceptance_ids) || input.acceptance_ids.length === 0 || input.acceptance_ids.some((id) => !nonEmptyString(id))) issues.push("acceptance_ids must be a non-empty string array");
  if (!Array.isArray(input.owned_paths) || input.owned_paths.length === 0) issues.push("owned_paths must contain at least one file");
  const readDependenciesValid = stringArray(input.read_dependencies, "read_dependencies", issues);
  const interfacesValid = stringArray(input.interfaces, "interfaces", issues);
  const constraintsValid = stringArray(input.constraints, "constraints", issues);
  const riskFlagsValid = stringArray(input.risk_flags, "risk_flags", issues);
  const contextReferencesValid = stringArray(input.context_references, "context_references", issues);
  const readDependencies = readDependenciesValid ? [...input.read_dependencies as string[]] : [];
  const interfaces = interfacesValid ? [...input.interfaces as string[]] : [];
  const constraints = constraintsValid ? [...input.constraints as string[]] : [];
  const riskFlags = riskFlagsValid ? [...input.risk_flags as string[]] : [];
  const contextReferences = contextReferencesValid ? [...input.context_references as string[]] : [];
  if (input.side_effect_class !== "read_only" && input.side_effect_class !== "bounded_write") issues.push("side_effect_class is invalid");
  if (!Array.isArray(input.verification)) issues.push("verification must be an array");
  const ownedPaths: OwnedPath[] = [];
  if (Array.isArray(input.owned_paths)) {
    for (const [index, raw] of input.owned_paths.entries()) {
      const item = record(raw);
      if (!item || !nonEmptyString(item.canonical_relative_path) || (item.existing_or_new !== "existing" && item.existing_or_new !== "new")) {
        issues.push(`owned_paths[${index}] is invalid`);
        continue;
      }
      ownedPaths.push({ canonical_relative_path: item.canonical_relative_path, existing_or_new: item.existing_or_new });
    }
  }
  const verification: VerificationCommand[] = [];
  if (Array.isArray(input.verification)) {
    for (const [index, raw] of input.verification.entries()) {
      const item = record(raw);
      if (!item) {
        issues.push(`verification[${index}] is invalid`);
        continue;
      }
      const commandIsArgv = Array.isArray(item.command) && item.command.length > 0 && item.command.every((argument) => nonEmptyString(argument));
      if (!commandIsArgv) issues.push(`verification[${index}].command must contain only non-empty argv strings`);
      verification.push({
        command: Array.isArray(item.command) ? item.command.filter((argument): argument is string => typeof argument === "string") : [],
        cwd: typeof item.cwd === "string" ? item.cwd : "",
        expected_result: typeof item.expected_result === "string" ? item.expected_result : "",
        before_result_ref: typeof item.before_result_ref === "string" ? item.before_result_ref : "",
        input_digest: typeof item.input_digest === "string" ? item.input_digest : ""
      });
    }
  }
  if (issues.length > 0) return undefined;
  return {
    main_task_id: input.main_task_id as string,
    task_unit_id: input.task_unit_id as string,
    revision: input.revision as number,
    root_intent_ref: input.root_intent_ref as string,
    objective: input.objective as string,
    rationale: input.rationale as string,
    acceptance_ids: [...input.acceptance_ids as string[]],
    owned_paths: ownedPaths,
    read_dependencies: readDependencies,
    interfaces,
    constraints,
    authorization_ref: input.authorization_ref as string,
    side_effect_class: input.side_effect_class as SideEffectClass,
    verification,
    baseline_ref: input.baseline_ref as string,
    risk_flags: riskFlags,
    context_references: contextReferences,
    worker_packet_digest: input.worker_packet_digest as string
  };
}

export function validateTaskCapsule(value: unknown, intentValue: RootIntent | unknown, evidence: TrustedCapsuleEvidence): ValidationResult<TaskCapsule> {
  const intentResult = validateRootIntent(intentValue);
  if (!intentResult.ok) return invalid("INVALID_ROOT_INTENT", intentResult.issues);
  if (!evidence || typeof evidence !== "object") return invalid("INVALID_CAPSULE", ["trusted local evidence is required"]);
  const issues: string[] = [];
  const capsule = readCapsule(value, issues);
  if (!capsule) return invalid("INVALID_CAPSULE", issues);
  if (capsule.main_task_id !== intentResult.value.main_task_id) issues.push("main_task_id does not match RootIntent");
  if (!nonEmptyString(evidence.root_intent_ref) || evidence.root_intent_ref !== intentResult.value.intent_digest || capsule.root_intent_ref !== evidence.root_intent_ref) issues.push("root_intent_ref is not bound to the exact RootIntent digest");
  if (capsule.authorization_ref !== intentResult.value.authorization_ref) issues.push("authorization_ref does not match RootIntent");
  const intentAcceptance = new Set(intentResult.value.acceptance.map((criterion) => criterion.id));
  const capsuleAcceptance = new Set(capsule.acceptance_ids);
  if (capsuleAcceptance.size !== capsule.acceptance_ids.length) issues.push("acceptance_ids must be unique");
  for (const id of capsuleAcceptance) if (!intentAcceptance.has(id)) issues.push(`acceptance id ${id} does not belong to RootIntent`);
  if (!nonEmptyString(evidence.baseline?.baseline_ref) || evidence.baseline.baseline_ref !== capsule.baseline_ref || !Array.isArray(evidence.baseline.exact_paths)) issues.push("baseline_ref is missing or not bound to the trusted baseline");
  if (!evidence.authorization || !Array.isArray(evidence.authorization.exact_paths)) issues.push("trusted authorization paths are required");
  validateAuthorization(capsule, intentResult.value, evidence, issues);
  validateVerification(capsule, evidence, issues);
  if (Array.isArray(evidence.baseline?.exact_paths)) {
    const baselinePaths = [...evidence.baseline.exact_paths].sort();
    const ownedPaths = capsule.owned_paths.map((path) => path.canonical_relative_path).sort();
    if (!ownedPaths.every((path) => baselinePaths.includes(path))) issues.push("baseline evidence must cover every owned path");
  }
  validatePaths(capsule, evidence, issues);
  if (issues.length > 0) {
    const code = issues.some((issue) => issue.includes("authorization")) ? "AUTHORIZATION_MISMATCH" : issues.some((issue) => issue.includes("baseline")) ? "BASELINE_MISSING" : issues.some((issue) => issue.includes("verification")) ? "VERIFICATION_INVALID" : issues.some((issue) => issue.includes("owned path") || issue.includes("read dependency") || issue.includes("symlink") || issue.includes("case alias")) ? "INVALID_PATH" : "INVALID_CAPSULE";
    return invalid(code, issues);
  }
  return { ok: true, value: capsule, utf8_bytes: utf8ByteSize(capsuleRecord(capsule)) };
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && new Set(left).size === new Set(right).size && left.every((item) => right.includes(item));
}

export function validateCorrection(previous: TaskCapsule, nextValue: unknown, intent: RootIntent, evidence: TrustedCapsuleEvidence): ValidationResult<TaskCapsule> {
  const previousResult = validateTaskCapsule(previous, intent, evidence);
  if (!previousResult.ok) return previousResult;
  const nextRecord = record(nextValue);
  if (!nextRecord || typeof nextRecord.revision !== "number") return invalid("CORRECTION_EXPANDS_SCOPE", ["correction must contain a numeric revision"]);
  const nextAcceptance = Array.isArray(nextRecord.acceptance_ids) ? nextRecord.acceptance_ids.filter((id): id is string => typeof id === "string") : [];
  const previousOwned = previous.owned_paths.map((path) => path.canonical_relative_path);
  const nextOwned = Array.isArray(nextRecord.owned_paths) ? nextRecord.owned_paths.map((path) => {
    const item = record(path);
    return typeof item?.canonical_relative_path === "string" ? item.canonical_relative_path : "";
  }) : [];
  const subset = nextOwned.every((path) => previousOwned.includes(path));
  const priorDependencies = previous.read_dependencies;
  const nextDependencies = Array.isArray(nextRecord.read_dependencies) ? nextRecord.read_dependencies.filter((path): path is string => typeof path === "string") : [];
  const dependenciesSubset = nextDependencies.every((path) => priorDependencies.includes(path));
  if (nextRecord.main_task_id !== previous.main_task_id || nextRecord.task_unit_id !== previous.task_unit_id || nextRecord.root_intent_ref !== previous.root_intent_ref || nextRecord.authorization_ref !== previous.authorization_ref || nextRecord.side_effect_class !== previous.side_effect_class || nextRecord.baseline_ref !== previous.baseline_ref) return invalid("CORRECTION_EXPANDS_SCOPE", ["correction must retain task identity, authorization, effect, and baseline"]);
  if (nextRecord.revision <= previous.revision) return invalid("CORRECTION_EXPANDS_SCOPE", ["correction revision must increase"]);
  if (!sameSet(nextAcceptance, previous.acceptance_ids)) return invalid("CORRECTION_EXPANDS_SCOPE", ["correction must preserve the complete prior acceptance set"]);
  if (!subset || !dependenciesSubset) return invalid("CORRECTION_EXPANDS_SCOPE", ["correction may only narrow owned paths and read dependencies"]);
  const narrowedEvidence: TrustedCapsuleEvidence = {
    ...evidence,
    authorization: { ...evidence.authorization, exact_paths: [...nextOwned] }
  };
  return validateTaskCapsule(nextValue, intent, narrowedEvidence);
}

function languageForExtension(extension: string): string {
  const languages: Record<string, string> = {
    ".cjs": "javascript", ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
    ".c": "c", ".cc": "c++", ".cpp": "c++", ".css": "css", ".go": "go", ".html": "html",
    ".java": "java", ".json": "json", ".md": "markdown", ".py": "python", ".rs": "rust",
    ".sh": "shell", ".sql": "sql", ".ts": "typescript", ".tsx": "typescript", ".vue": "vue", ".yaml": "yaml", ".yml": "yaml"
  };
  return languages[extension.toLowerCase()] ?? `extension:${extension.toLowerCase()}`;
}

function contextBucket(bytes: number): ContextSizeBucket {
  if (bytes <= 0) return "0";
  if (bytes < 4 * 1024) return "1-4KiB";
  if (bytes < 16 * 1024) return "4-16KiB";
  if (bytes < 32 * 1024) return "16-32KiB";
  return "32KiB+";
}

export function deriveTaskTraits(capsule: TaskCapsule, _intent: RootIntent, facts: TraitEvidence): TaskTraits {
  const count = capsule.owned_paths.length;
  const owned_file_count_bucket: OwnedFileCountBucket = count === 1 ? "1" : count <= 5 ? "2-5" : count <= 20 ? "6-20" : "21+";
  const changed_language = [...new Set(capsule.owned_paths.map((path) => languageForExtension(posix.extname(path.canonical_relative_path))) )].sort();
  const context_bytes = facts.context_bytes;
  if (!Number.isFinite(context_bytes) || context_bytes < 0) throw new RangeError("context_bytes must be a finite non-negative number");
  if (typeof facts.persistent_change !== "boolean") throw new TypeError("persistent_change must be an explicit boolean fact");
  return {
    owned_file_count_bucket,
    changed_language,
    side_effect_class: capsule.side_effect_class,
    public_interface_touched: capsule.interfaces.length > 0,
    verification_count: capsule.verification.length,
    context_size_bucket: contextBucket(context_bytes),
    persistent_change: facts.persistent_change,
    risk_flags: [...capsule.risk_flags]
  };
}

function opaqueRef(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(value);
}

const CONTENT_CATEGORIES = new Set<EgressContentCategory>([
  "task_summary", "acceptance_summary", "interface_constraints", "risk_facts",
  "task_traits", "context_summary", "provenance", "untrusted_quoted_task_material"
]);

function categoryForField(field: SummaryField): EgressContentCategory {
  switch (field) {
    case "objective_summary": return "task_summary";
    case "acceptance_summaries": return "acceptance_summary";
    case "interface_constraints": return "interface_constraints";
    case "risk_flags": return "risk_facts";
    case "relevant_context_summary": return "context_summary";
    case "correction_summary": return "task_summary";
  }
}

function validateProvenance(input: ProjectionAuthoringInput, issues: string[]): void {
  if (!Array.isArray(input.provenance) || input.provenance.length === 0) {
    issues.push("provenance is required");
    return;
  }
  const refs = new Set<string>();
  for (const [index, provenance] of input.provenance.entries()) {
    if (!provenance || !opaqueRef(provenance.ref) || refs.has(provenance.ref)) issues.push(`provenance[${index}] has an invalid or duplicate opaque reference`);
    refs.add(provenance?.ref ?? "");
    if (!["root_authored", "measured_repository_fact", "trusted_host_policy_fact", "untrusted_quoted_task_material"].includes(provenance?.kind)) issues.push(`provenance[${index}] has an unknown kind`);
    if (!provenance || !CONTENT_CATEGORIES.has(provenance.content_category)) issues.push(`provenance[${index}] has an unknown content category`);
    if (provenance?.kind === "untrusted_quoted_task_material" && provenance.authority !== "data") issues.push(`provenance[${index}] must remain data authority`);
    if (provenance?.kind !== "untrusted_quoted_task_material" && provenance?.authority !== "fact") issues.push(`provenance[${index}] must be a fact authority`);
  }
  if (!Array.isArray(input.summary_attestations) || input.summary_attestations.length === 0) {
    issues.push("summary attestation is required");
    return;
  }
  for (const [index, attestation] of input.summary_attestations.entries()) {
    if (!attestation || attestation.attested_by !== "root" || !refs.has(attestation.provenance_ref) || !CONTENT_CATEGORIES.has(categoryForField(attestation.field === "all" ? "objective_summary" : attestation.field)) || attestation.route_directed !== false || attestation.meaning_preserved !== true) issues.push(`summary_attestations[${index}] is not an explicit neutral Root attestation`);
    const provenance = input.provenance.find((entry) => entry.ref === attestation?.provenance_ref);
    if (!provenance || !attestation || provenance.kind !== attestation.classification) issues.push(`summary_attestations[${index}] does not match its provenance kind`);
  }
}

function attested(input: ProjectionAuthoringInput, field: SummaryField): boolean {
  const category = categoryForField(field);
  return input.summary_attestations.some((attestation) => {
    if (attestation.field !== "all" && attestation.field !== field) return false;
    const provenance = input.provenance.find((entry) => entry.ref === attestation.provenance_ref);
    return provenance?.content_category === category && provenance.kind === attestation.classification && attestation.attested_by === "root" && attestation.route_directed === false && attestation.meaning_preserved === true;
  });
}

function validateEgress(input: ProjectionAuthoringInput, required: EgressContentCategory[], issues: string[]): void {
  const policy = input.egress_policy;
  if (!policy || policy.approved !== true || !nonEmptyString(policy.provider_id) || !opaqueRef(policy.approval_ref) || !nonEmptyString(policy.policy_digest) || !nonEmptyString(policy.purpose)) {
    issues.push("approved egress policy evidence is required");
    return;
  }
  if (!Array.isArray(policy.allowed_content_categories)) {
    issues.push("egress policy content categories are required");
    return;
  }
  if (policy.allowed_content_categories.some((category) => !CONTENT_CATEGORIES.has(category))) issues.push("egress policy contains an unknown content category");
  for (const category of required) if (!policy.allowed_content_categories.includes(category)) issues.push(`egress policy does not approve ${category}`);
  if (Array.isArray(input.provenance)) {
    for (const [index, provenance] of input.provenance.entries()) if (!policy.allowed_content_categories.includes(provenance.content_category)) issues.push(`egress policy does not approve provenance[${index}] content category ${provenance.content_category}`);
    for (const category of required) if (!input.provenance.some((provenance) => provenance.content_category === category)) issues.push(`provenance does not attest content category ${category}`);
  }
}

function validateSummaryText(value: string | undefined, field: SummaryField, input: ProjectionAuthoringInput, issues: string[]): value is string {
  if (!nonEmptyString(value)) {
    issues.push(`${field} is incomplete`);
    return false;
  }
  if (!attested(input, field)) issues.push(`${field} has no explicit Root provenance attestation`);
  return true;
}

function projectionRecord(projection: RoutingProjection): Record<string, unknown> {
  return {
    schema_revision: projection.schema_revision,
    projection_rule_digest: projection.projection_rule_digest,
    main_task_id: projection.main_task_id,
    task_unit_id: projection.task_unit_id,
    capsule_revision: projection.capsule_revision,
    capsule_digest: projection.capsule_digest,
    intent_digest: projection.intent_digest,
    authorization_revision: projection.authorization_revision,
    objective_summary: projection.objective_summary,
    acceptance_summaries: projection.acceptance_summaries.map((summary) => ({ id: summary.id, summary: summary.summary })),
    task_traits: {
      owned_file_count_bucket: projection.task_traits.owned_file_count_bucket,
      changed_language: [...projection.task_traits.changed_language],
      side_effect_class: projection.task_traits.side_effect_class,
      public_interface_touched: projection.task_traits.public_interface_touched,
      verification_count: projection.task_traits.verification_count,
      context_size_bucket: projection.task_traits.context_size_bucket,
      persistent_change: projection.task_traits.persistent_change,
      risk_flags: [...projection.task_traits.risk_flags]
    },
    interface_constraints: [...projection.interface_constraints],
    risk_flags: [...projection.risk_flags],
    side_effect_class: projection.side_effect_class,
    relevant_context_summary: projection.relevant_context_summary,
    context_complete: projection.context_complete,
    ...(projection.correction_summary === undefined ? {} : { correction_summary: projection.correction_summary }),
    provenance: projection.provenance.map((entry) => ({ kind: entry.kind, ref: entry.ref, content_category: entry.content_category, authority: entry.authority })),
    egress_policy_digest: projection.egress_policy_digest
  };
}

function makeProjectionArgs(input: ProjectionAuthoringInput, capsule: TaskCapsule, intent: RootIntent): ProjectionResult<RoutingProjection> {
  const issues: string[] = [];
  validateProvenance(input, issues);
  const requiredCategories: EgressContentCategory[] = ["task_summary", "acceptance_summary", "interface_constraints", "risk_facts", "task_traits", "context_summary", "provenance"];
  if (Array.isArray(input.provenance) && input.provenance.some((entry) => entry.kind === "untrusted_quoted_task_material")) requiredCategories.push("untrusted_quoted_task_material");
  validateEgress(input, requiredCategories, issues);
  if (!nonEmptyString(input.objective_summary)) issues.push("objective_summary is incomplete");
  const objective = input.objective_summary;
  validateSummaryText(objective, "objective_summary", input, issues);
  const acceptanceSummaries = input.acceptance_summaries;
  if (!Array.isArray(acceptanceSummaries) || acceptanceSummaries.length !== capsule.acceptance_ids.length) issues.push("acceptance_summaries must explicitly cover every capsule acceptance id");
  const accepted = new Set<string>();
  for (const [index, summary] of (Array.isArray(acceptanceSummaries) ? acceptanceSummaries : []).entries()) {
    if (!summary || !nonEmptyString(summary.id) || !nonEmptyString(summary.summary) || accepted.has(summary.id) || !capsule.acceptance_ids.includes(summary.id)) issues.push(`acceptance_summaries[${index}] is incomplete or not accepted by the capsule`);
    if (summary && nonEmptyString(summary.summary)) validateSummaryText(summary.summary, "acceptance_summaries", input, issues);
    if (summary) accepted.add(summary.id);
  }
  const interfaceConstraints = input.interface_constraints;
  if (!Array.isArray(interfaceConstraints) || interfaceConstraints.some((item) => !nonEmptyString(item))) issues.push("interface_constraints is invalid");
  else if (!attested(input, "interface_constraints")) issues.push("interface_constraints has no explicit Root provenance attestation");
  if (!attested(input, "risk_flags")) issues.push("risk_flags has no explicit Root provenance attestation");
  const contextSummary = input.relevant_context_summary;
  validateSummaryText(contextSummary, "relevant_context_summary", input, issues);
  if (input.context_complete !== true) issues.push("context_complete must be true before egress");
  if (typeof input.context_bytes !== "number" || !Number.isFinite(input.context_bytes) || input.context_bytes < 0 || typeof input.persistent_change !== "boolean") issues.push("persistent_change and context_bytes must be explicit trusted trait facts");
  if (input.correction_summary !== undefined) validateSummaryText(input.correction_summary, "correction_summary", input, issues);
  if (issues.length > 0) return projectionInvalid(issues.some((issue) => issue.includes("egress")) ? "EGRESS_NOT_APPROVED" : issues.some((issue) => issue.includes("provenance") || issue.includes("attestation")) ? "INVALID_PROVENANCE" : issues.some((issue) => issue.includes("incomplete") || issue.includes("context_complete")) ? "INCOMPLETE_SUMMARY" : "UNSAFE_PROJECTION", issues);
  const traits = deriveTaskTraits(capsule, intent, { context_bytes: input.context_bytes, persistent_change: input.persistent_change });
  const projection: RoutingProjection = {
    schema_revision: PROJECTION_SCHEMA_REVISION,
    projection_rule_digest: PROJECTION_RULE_DIGEST,
    main_task_id: capsule.main_task_id,
    task_unit_id: capsule.task_unit_id,
    capsule_revision: capsule.revision,
    capsule_digest: digest(capsuleRecord(capsule)),
    intent_digest: intent.intent_digest,
    authorization_revision: intent.authorization_revision,
    objective_summary: objective as string,
    acceptance_summaries: acceptanceSummaries.map((summary) => ({ id: summary.id, summary: summary.summary })),
    task_traits: traits,
    interface_constraints: [...interfaceConstraints],
    risk_flags: [...capsule.risk_flags],
    side_effect_class: capsule.side_effect_class,
    relevant_context_summary: contextSummary as string,
    context_complete: true,
    ...(input.correction_summary === undefined ? {} : { correction_summary: input.correction_summary }),
    provenance: input.provenance.map((entry) => ({ kind: entry.kind, ref: entry.ref, content_category: entry.content_category, authority: entry.authority })),
    egress_policy_digest: input.egress_policy.policy_digest
  };
  return { ok: true, value: projection, utf8_bytes: utf8ByteSize(projectionRecord(projection)) };
}

export function buildRoutingProjection(intent: RootIntent, capsule: TaskCapsule, input: ProjectionAuthoringInput): ProjectionResult<RoutingProjection> {
  return makeProjectionArgs(input, capsule, intent);
}

function packetRecord(packet: WorkerPacket): Record<string, unknown> {
  return {
    OBJECTIVE: packet.OBJECTIVE,
    "FILES AND OWNERSHIP": {
      owned_paths: packet["FILES AND OWNERSHIP"].owned_paths.map((path) => ({ canonical_relative_path: path.canonical_relative_path, existing_or_new: path.existing_or_new })),
      read_dependencies: [...packet["FILES AND OWNERSHIP"].read_dependencies],
      context_references: [...packet["FILES AND OWNERSHIP"].context_references]
    },
    INTERFACES: packet.INTERFACES === "none" ? "none" : [...packet.INTERFACES],
    CONSTRAINTS: packet.CONSTRAINTS === "none" ? "none" : [...packet.CONSTRAINTS],
    VERIFICATION: packet.VERIFICATION.map((verification) => ({
      command: [...verification.command], cwd: verification.cwd, expected_result: verification.expected_result,
      before_result_ref: verification.before_result_ref, input_digest: verification.input_digest
    })),
    RETURN: {
      STATUS: packet.RETURN.STATUS,
      CHANGES: packet.RETURN.CHANGES,
      VERIFIED: packet.RETURN.VERIFIED,
      "JUDGMENT CALLS": packet.RETURN["JUDGMENT CALLS"],
      GAPS: packet.RETURN.GAPS
    }
  };
}

export function projectWorkerPacket(capsule: TaskCapsule): ProjectionResult<WorkerPacket> {
  const issues: string[] = [];
  if (!nonEmptyString(capsule.objective)) issues.push("worker packet objective is incomplete");
  if (capsule.verification.length === 0) issues.push("worker packet requires pre-run verification");
  if (issues.length > 0) return projectionInvalid("INCOMPLETE_SUMMARY", issues);
  const packet: WorkerPacket = {
    OBJECTIVE: capsule.objective,
    "FILES AND OWNERSHIP": {
      owned_paths: capsule.owned_paths.map((path) => ({ canonical_relative_path: path.canonical_relative_path, existing_or_new: path.existing_or_new })),
      read_dependencies: [...capsule.read_dependencies],
      context_references: [...capsule.context_references]
    },
    INTERFACES: capsule.interfaces.length === 0 ? "none" : [...capsule.interfaces],
    CONSTRAINTS: capsule.constraints.length === 0 ? "none" : [...capsule.constraints],
    VERIFICATION: capsule.verification.map((verification) => ({
      command: [...verification.command], cwd: verification.cwd, expected_result: verification.expected_result,
      before_result_ref: verification.before_result_ref, input_digest: verification.input_digest
    })),
    RETURN: {
      STATUS: "required",
      CHANGES: "List only changes made within the owned paths.",
      VERIFIED: "List the requested verification results; do not substitute a self-report for Root evidence.",
      "JUDGMENT CALLS": "List material judgment calls, or none.",
      GAPS: "List unresolved gaps, or none."
    }
  };
  return { ok: true, value: packet, utf8_bytes: utf8ByteSize(packetRecord(packet)) };
}

/** UTF-8 bytes of a canonical JSON value; this is not a provider-token count. */
export function utf8ByteSize(value: unknown): number {
  return Buffer.byteLength(canonicalJson(value), "utf8");
}

export function serializeRoutingProjection(projection: RoutingProjection): string {
  return canonicalJson(projectionRecord(projection));
}

export function serializeWorkerPacket(packet: WorkerPacket): string {
  return canonicalJson(packetRecord(packet));
}
