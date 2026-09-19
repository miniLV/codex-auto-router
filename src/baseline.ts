import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { isAbsolute, posix, relative, resolve, win32 } from "node:path";
import { tmpdir } from "node:os";
import { digest } from "./canonical.js";

export type BaselineRole = "owned" | "input" | "dependency";
export type ExpectedState = "existing" | "new";
export type SnapshotKind = "absent" | "file" | "symlink";

export interface AuthorizedPath {
  canonical_relative_path: string;
  existing_or_new: ExpectedState;
  role: BaselineRole;
}

export interface BaselineRequest {
  source_root: string;
  authorized_paths: AuthorizedPath[];
}

export interface SnapshotEntry {
  canonical_relative_path: string;
  existing_or_new: ExpectedState;
  role: BaselineRole;
  kind: SnapshotKind;
  mode: number | null;
  content_digest: string | null;
  symlink_target: string | null;
  symlink_target_path: string | null;
}

export interface SnapshotManifest {
  entries: SnapshotEntry[];
}

export interface BaselineSnapshot {
  source_root: string;
  isolated_root: string;
  manifest: SnapshotManifest;
  manifest_digest: string;
  input_digest: string;
  dependency_digest: string;
}

declare const baselineHandleBrand: unique symbol;
export interface BaselineHandle {
  readonly [baselineHandleBrand]: true;
}

export interface RecoveryGate {
  trusted_child_stopped: true;
  caller_gate: "root_baseline_recovery";
  child_stop_evidence_ref: string;
}

export type RecoveryFailureCode =
  | "INVALID_HANDLE"
  | "RECOVERY_GATE_REQUIRED"
  | "ISOLATED_ROOT_IDENTITY_MISMATCH"
  | "RECOVERY_FAILED"
  | "ALREADY_DISCARDED";

export type RecoveryResult =
  | { ok: true; action: "restored" | "discarded"; before_restore_diff?: OutputDiff }
  | { ok: false; code: RecoveryFailureCode; message: string };

export type OutputKind = "absent" | "directory" | "file" | "symlink" | "special";

export interface OutputState {
  canonical_relative_path: string;
  kind: OutputKind;
  mode: number | null;
  content_digest: string | null;
  symlink_target: string | null;
}

export type DiffDimension = "presence" | "content" | "mode" | "type" | "symlink";
export type DiffScope = "owned" | "authorized_read" | "out_of_scope";

export interface OutputChange {
  canonical_relative_path: string;
  scope: DiffScope;
  dimensions: DiffDimension[];
  before: OutputState;
  after: OutputState;
}

export interface OutputDiff {
  baseline_manifest_digest: string;
  output_manifest_digest: string;
  changes: OutputChange[];
  out_of_scope_paths: string[];
  unsafe_symlink_paths: string[];
  has_out_of_scope_changes: boolean;
  clean: boolean;
}

export class BaselineError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "SOURCE_STATE_UNKNOWN" | "HANDLE_INVALID" | "ISOLATED_ROOT_IDENTITY_MISMATCH" | "OUTPUT_STATE_UNKNOWN", message: string) {
    super(`${code}: ${message}`);
    this.name = "BaselineError";
  }
}

interface Identity {
  dev: number;
  ino: number;
}

interface DirectoryMode {
  canonical_relative_path: string;
  mode: number;
}

interface CapturedPath {
  requested: AuthorizedPath;
  source_path: string;
  kind: SnapshotKind;
  mode: number | null;
  content_digest: string | null;
  symlink_target: string | null;
  symlink_target_path: string | null;
}

interface InternalState {
  kind: OutputKind;
  mode: number | null;
  content_digest: string | null;
  symlink_target: string | null;
}

interface InternalRecord {
  allocation_root: string;
  allocation_identity: Identity;
  isolated_root: string;
  isolated_identity: Identity;
  backup_root: string;
  backup_identity: Identity;
  source_root: string;
  authorized_paths: Map<string, AuthorizedPath>;
  captured: CapturedPath[];
  directory_modes: DirectoryMode[];
  snapshot: BaselineSnapshot;
  baseline_states: Map<string, InternalState>;
  baseline_manifest_digest: string;
  status: "active" | "discarded";
}

const handles = new WeakMap<object, InternalRecord>();

function fail(code: BaselineError["code"], message: string): never {
  throw new BaselineError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[\u0000\r\n]/.test(value);
}

function canonicalPath(value: unknown): value is string {
  return validText(value) && value.length <= 4096 && !isAbsolute(value) && !win32.isAbsolute(value) && !/^[A-Za-z]:/.test(value) && !value.includes("\\") && value !== "." && !value.endsWith("/") && !value.includes("//") && posix.normalize(value) === value && value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && !/[*?\[\]{}]/.test(part));
}

function pathContained(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate);
  return remainder === "" || (remainder !== ".." && !remainder.startsWith(`${posix.sep}..${posix.sep}`) && !remainder.startsWith(`..${posix.sep}`) && !isAbsolute(remainder));
}

function lower(value: string): string {
  return value.toLocaleLowerCase("en-US");
}

function identity(path: string): Identity {
  const stat = lstatSync(path);
  return { dev: Number(stat.dev), ino: Number(stat.ino) };
}

function sameIdentity(left: Identity, right: Identity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sourceRoot(rootValue: string): string {
  if (!validText(rootValue)) fail("INVALID_REQUEST", "source_root is required");
  const root = resolve(rootValue);
  let stat;
  try { stat = lstatSync(root); } catch { fail("SOURCE_STATE_UNKNOWN", "source_root cannot be inspected"); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail("INVALID_REQUEST", "source_root must be a real directory");
  return root;
}

interface ResolvedLiteral {
  absolute_path: string;
  exists: boolean;
}

function resolveLiteral(root: string, pathValue: string, allowMissing: boolean): ResolvedLiteral {
  let current = root;
  const parts = pathValue.split("/");
  for (const [index, part] of parts.entries()) {
    let names: string[];
    try { names = readdirSync(current); } catch { fail("SOURCE_STATE_UNKNOWN", `cannot read parent of ${pathValue}`); }
    const exact = names.filter((name) => name === part);
    const aliases = names.filter((name) => lower(name) === lower(part));
    const final = index === parts.length - 1;
    if (exact.length === 0) {
      if (aliases.length > 0) fail("INVALID_REQUEST", `case alias is not canonical: ${pathValue}`);
      if (final && allowMissing) {
        try {
          const parentStat = lstatSync(current);
          if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) fail("INVALID_REQUEST", `new path parent is not a real directory: ${pathValue}`);
        } catch (error) {
          if (error instanceof BaselineError) throw error;
          fail("SOURCE_STATE_UNKNOWN", `new path parent cannot be inspected: ${pathValue}`);
        }
        return { absolute_path: resolve(current, part), exists: false };
      }
      fail("INVALID_REQUEST", `path does not exist: ${pathValue}`);
    }
    if (aliases.length !== 1) fail("INVALID_REQUEST", `ambiguous case alias: ${pathValue}`);
    const next = resolve(current, exact[0]);
    let nextStat;
    try { nextStat = lstatSync(next); } catch { fail("SOURCE_STATE_UNKNOWN", `path changed during capture: ${pathValue}`); }
    if (!final) {
      if (nextStat.isSymbolicLink()) fail("INVALID_REQUEST", `symlinked parent is not allowed: ${pathValue}`);
      if (!nextStat.isDirectory()) fail("INVALID_REQUEST", `path parent is not a directory: ${pathValue}`);
    }
    current = next;
  }
  return { absolute_path: current, exists: true };
}

function validateRequest(request: BaselineRequest): { root: string; paths: AuthorizedPath[] } {
  if (!isRecord(request) || !Array.isArray(request.authorized_paths) || request.authorized_paths.length === 0) fail("INVALID_REQUEST", "authorized_paths must be a non-empty literal list");
  const root = sourceRoot(request.source_root);
  const seen = new Set<string>();
  const paths: AuthorizedPath[] = [];
  for (const [index, raw] of request.authorized_paths.entries()) {
    if (!isRecord(raw) || !canonicalPath(raw.canonical_relative_path) || !["existing", "new"].includes(raw.existing_or_new as string) || !["owned", "input", "dependency"].includes(raw.role as string)) fail("INVALID_REQUEST", `authorized_paths[${index}] is not a literal authorized file record`);
    const path = raw.canonical_relative_path as string;
    const role = raw.role as BaselineRole;
    const expected = raw.existing_or_new as ExpectedState;
    if (expected === "new" && role !== "owned") fail("INVALID_REQUEST", `only owned paths may be new: ${path}`);
    const key = lower(path);
    if (seen.has(key)) fail("INVALID_REQUEST", `duplicate or case-alias path: ${path}`);
    seen.add(key);
    paths.push({ canonical_relative_path: path, existing_or_new: expected, role });
  }
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      const a = paths[left].canonical_relative_path.split("/");
      const b = paths[right].canonical_relative_path.split("/");
      const prefix = (shorter: string[], longer: string[]) => shorter.length < longer.length && shorter.every((part, index) => part === longer[index]);
      if (prefix(a, b) || prefix(b, a)) fail("INVALID_REQUEST", `authorized paths overlap: ${paths[left].canonical_relative_path} and ${paths[right].canonical_relative_path}`);
    }
  }
  return { root, paths };
}

function fileDigest(path: string): { digest: string; mode: number; bytes: Buffer } {
  let before;
  try { before = lstatSync(path); } catch { fail("SOURCE_STATE_UNKNOWN", `file disappeared during capture: ${path}`); }
  if (!before.isFile()) fail("INVALID_REQUEST", `expected a regular file: ${path}`);
  const bytes = readFileSync(path);
  let after;
  try { after = lstatSync(path); } catch { fail("SOURCE_STATE_UNKNOWN", `file changed during capture: ${path}`); }
  if (!after.isFile() || Number(before.dev) !== Number(after.dev) || Number(before.ino) !== Number(after.ino) || before.size !== after.size || before.mtimeMs !== after.mtimeMs || (before.mode & 0o7777) !== (after.mode & 0o7777)) fail("SOURCE_STATE_UNKNOWN", `file changed during capture: ${path}`);
  return { digest: createHash("sha256").update(bytes).digest("hex"), mode: before.mode & 0o7777, bytes };
}

function collectDirectoryModes(root: string, paths: AuthorizedPath[]): DirectoryMode[] {
  const modes = new Map<string, number>();
  for (const authorized of paths) {
    let current = resolve(root, authorized.canonical_relative_path);
    for (;;) {
      const parent = resolve(current, "..");
      if (parent === current || !pathContained(root, parent)) break;
      const relativePath = relative(root, parent);
      if (relativePath === "") break;
      const stat = lstatSync(parent);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail("INVALID_REQUEST", `authorized parent is not a real directory: ${relativePath}`);
      modes.set(relativePath, stat.mode & 0o7777);
      current = parent;
    }
  }
  return [...modes.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([canonical_relative_path, mode]) => ({ canonical_relative_path, mode }));
}

function ensureDirectories(root: string, directoryModes: DirectoryMode[]): void {
  for (const directory of directoryModes) {
    const path = resolve(root, directory.canonical_relative_path);
    mkdirSync(path, { recursive: true, mode: directory.mode });
    chmodSync(path, directory.mode);
  }
}

function linkTarget(sourceRoot: string, sourcePath: string, rawTarget: string, authorized: Map<string, AuthorizedPath>): string {
  const targetAbsolute = isAbsolute(rawTarget) ? resolve(rawTarget) : resolve(sourcePath, "..", rawTarget);
  if (!pathContained(sourceRoot, targetAbsolute)) fail("INVALID_REQUEST", `symlink escapes source_root: ${relative(sourceRoot, sourcePath)}`);
  const targetRelative = relative(sourceRoot, targetAbsolute);
  if (!canonicalPath(targetRelative) || !authorized.has(targetRelative)) fail("INVALID_REQUEST", `symlink target is not an authorized literal file: ${targetRelative}`);
  const targetStat = lstatSync(targetAbsolute);
  if (targetStat.isSymbolicLink() || !targetStat.isFile()) fail("INVALID_REQUEST", `symlink target must be an authorized regular file: ${targetRelative}`);
  return targetRelative;
}

function captureEntries(root: string, paths: AuthorizedPath[], authorized: Map<string, AuthorizedPath>): { captured: CapturedPath[]; manifestEntries: SnapshotEntry[]; directoryModes: DirectoryMode[] } {
  const captured: CapturedPath[] = [];
  const manifestEntries: SnapshotEntry[] = [];
  for (const requested of paths) {
    const resolved = resolveLiteral(root, requested.canonical_relative_path, requested.existing_or_new === "new");
    if (requested.existing_or_new === "new" && resolved.exists) fail("INVALID_REQUEST", `new owned path already exists: ${requested.canonical_relative_path}`);
    if (requested.existing_or_new === "existing" && !resolved.exists) fail("SOURCE_STATE_UNKNOWN", `required source path is absent: ${requested.canonical_relative_path}`);
    if (!resolved.exists) {
      const entry: CapturedPath = { requested, source_path: resolved.absolute_path, kind: "absent", mode: null, content_digest: null, symlink_target: null, symlink_target_path: null };
      captured.push(entry);
      manifestEntries.push({ ...requested, kind: "absent", mode: null, content_digest: null, symlink_target: null, symlink_target_path: null });
      continue;
    }
    const stat = lstatSync(resolved.absolute_path);
    if (stat.isFile()) {
      const file = fileDigest(resolved.absolute_path);
      const entry: CapturedPath = { requested, source_path: resolved.absolute_path, kind: "file", mode: file.mode, content_digest: file.digest, symlink_target: null, symlink_target_path: null };
      captured.push(entry);
      manifestEntries.push({ ...requested, kind: "file", mode: file.mode, content_digest: file.digest, symlink_target: null, symlink_target_path: null });
    } else if (stat.isSymbolicLink()) {
      const rawTarget = readlinkSync(resolved.absolute_path);
      const targetPath = linkTarget(root, resolved.absolute_path, rawTarget, authorized);
      const entry: CapturedPath = { requested, source_path: resolved.absolute_path, kind: "symlink", mode: stat.mode & 0o7777, content_digest: digest(rawTarget), symlink_target: rawTarget, symlink_target_path: targetPath };
      captured.push(entry);
      manifestEntries.push({ ...requested, kind: "symlink", mode: entry.mode, content_digest: entry.content_digest, symlink_target: rawTarget, symlink_target_path: targetPath });
    } else {
      fail("INVALID_REQUEST", `authorized path is not a regular file or safe symlink: ${requested.canonical_relative_path}`);
    }
  }
  return { captured, manifestEntries: manifestEntries.sort((left, right) => left.canonical_relative_path.localeCompare(right.canonical_relative_path)), directoryModes: collectDirectoryModes(root, paths) };
}

function ensureParent(root: string, pathValue: string, directoryModes: DirectoryMode[]): void {
  const parent = posix.dirname(pathValue);
  if (parent !== ".") {
    const mode = directoryModes.find((directory) => directory.canonical_relative_path === parent)?.mode ?? 0o755;
    mkdirSync(resolve(root, parent), { recursive: true, mode });
  }
}

function materialize(root: string, backupRoot: string, captured: CapturedPath[], directoryModes: DirectoryMode[]): void {
  ensureDirectories(backupRoot, directoryModes);
  ensureDirectories(root, directoryModes);
  for (const entry of captured.filter((item) => item.kind === "file")) {
    const pathValue = entry.requested.canonical_relative_path;
    ensureParent(backupRoot, pathValue, directoryModes);
    ensureParent(root, pathValue, directoryModes);
    const backupPath = resolve(backupRoot, pathValue);
    const outputPath = resolve(root, pathValue);
    const bytes = readFileSync(entry.source_path);
    writeFileSync(backupPath, bytes, { mode: entry.mode ?? 0o600 });
    chmodSync(backupPath, entry.mode ?? 0o600);
    copyFileSync(backupPath, outputPath);
    chmodSync(outputPath, entry.mode ?? 0o600);
  }
  for (const entry of captured.filter((item) => item.kind === "symlink")) {
    const targetPath = entry.symlink_target_path;
    if (!targetPath) fail("SOURCE_STATE_UNKNOWN", `safe symlink target disappeared: ${entry.requested.canonical_relative_path}`);
    const backupPath = resolve(backupRoot, entry.requested.canonical_relative_path);
    const outputPath = resolve(root, entry.requested.canonical_relative_path);
    const backupTarget = resolve(backupRoot, targetPath);
    const outputTarget = resolve(root, targetPath);
    ensureParent(backupRoot, entry.requested.canonical_relative_path, directoryModes);
    ensureParent(root, entry.requested.canonical_relative_path, directoryModes);
    symlinkSync(relative(posix.dirname(backupPath), backupTarget), backupPath);
    symlinkSync(relative(posix.dirname(outputPath), outputTarget), outputPath);
  }
}

function stateDigest(states: Map<string, InternalState>): string {
  return digest([...states.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([canonical_relative_path, state]) => ({ canonical_relative_path, ...state })));
}

function outputState(statPath: string, root: string, resolvedRoot: string): { state: InternalState; unsafe_symlink: boolean } {
  const stat = lstatSync(statPath);
  if (stat.isDirectory()) return { state: { kind: "directory", mode: stat.mode & 0o7777, content_digest: null, symlink_target: null }, unsafe_symlink: false };
  if (stat.isFile()) {
    const bytes = readFileSync(statPath);
    return { state: { kind: "file", mode: stat.mode & 0o7777, content_digest: createHash("sha256").update(bytes).digest("hex"), symlink_target: null }, unsafe_symlink: false };
  }
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(statPath);
    const targetAbsolute = isAbsolute(target) ? resolve(target) : resolve(statPath, "..", target);
    const safeLexical = pathContained(root, targetAbsolute);
    let safeResolved = safeLexical;
    if (safeLexical) {
      try { safeResolved = pathContained(resolvedRoot, realpathSync(targetAbsolute)); } catch { safeResolved = false; }
    }
    return { state: { kind: "symlink", mode: stat.mode & 0o7777, content_digest: digest(target), symlink_target: target }, unsafe_symlink: !safeResolved };
  }
  return { state: { kind: "special", mode: stat.mode & 0o7777, content_digest: null, symlink_target: null }, unsafe_symlink: false };
}

function inventory(root: string): { states: Map<string, InternalState>; unsafe_symlinks: string[] } {
  let resolvedRoot: string;
  try { resolvedRoot = realpathSync(root); } catch { fail("OUTPUT_STATE_UNKNOWN", "isolated output cannot be resolved"); }
  const states = new Map<string, InternalState>();
  const unsafe_symlinks: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    let names: string[];
    try { names = readdirSync(directory); } catch { fail("OUTPUT_STATE_UNKNOWN", `isolated output cannot be read: ${prefix || "."}`); }
    for (const name of names.sort()) {
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const absolutePath = resolve(directory, name);
      let stat;
      try { stat = lstatSync(absolutePath); } catch { fail("OUTPUT_STATE_UNKNOWN", `isolated output changed while being read: ${relativePath}`); }
      const inspected = outputState(absolutePath, root, resolvedRoot);
      states.set(relativePath, inspected.state);
      if (inspected.unsafe_symlink) unsafe_symlinks.push(relativePath);
      if (stat.isDirectory()) visit(absolutePath, relativePath);
    }
  };
  visit(root, "");
  return { states, unsafe_symlinks };
}

function baselineStates(record: InternalRecord): Map<string, InternalState> {
  const inventoryResult = inventory(record.isolated_root);
  const states = new Map(inventoryResult.states);
  for (const entry of record.snapshot.manifest.entries) if (entry.kind === "absent") states.set(entry.canonical_relative_path, { kind: "absent", mode: null, content_digest: null, symlink_target: null });
  return states;
}

function stateWithPath(pathValue: string, state: InternalState): OutputState {
  return { canonical_relative_path: pathValue, ...state };
}

function dimensions(before: InternalState, after: InternalState): DiffDimension[] {
  const result: DiffDimension[] = [];
  if (before.kind === "absent" && after.kind !== "absent" || before.kind !== "absent" && after.kind === "absent") result.push("presence");
  if (before.kind !== after.kind && !result.includes("presence")) result.push("type");
  if (before.mode !== after.mode && before.kind !== "absent" && after.kind !== "absent") result.push("mode");
  if (before.content_digest !== after.content_digest && before.kind !== "absent" && after.kind !== "absent") result.push("content");
  if (before.symlink_target !== after.symlink_target && (before.kind === "symlink" || after.kind === "symlink")) result.push("symlink");
  return result;
}

function ensureRecord(handle: BaselineHandle): InternalRecord {
  if (!handle || typeof handle !== "object") fail("HANDLE_INVALID", "baseline handle is not valid");
  const record = handles.get(handle as object);
  if (!record || record.status === "discarded") fail("HANDLE_INVALID", "baseline handle is unknown or discarded");
  return record;
}

function ensureRoots(record: InternalRecord): void {
  let allocation: Identity, isolated: Identity, backup: Identity;
  try {
    allocation = identity(record.allocation_root);
    isolated = identity(record.isolated_root);
    backup = identity(record.backup_root);
  } catch { fail("ISOLATED_ROOT_IDENTITY_MISMATCH", "allocated baseline directory is missing"); }
  if (!sameIdentity(allocation, record.allocation_identity) || !sameIdentity(isolated, record.isolated_identity) || !sameIdentity(backup, record.backup_identity)) fail("ISOLATED_ROOT_IDENTITY_MISMATCH", "allocated baseline directory was replaced or moved");
  const isolatedStat = lstatSync(record.isolated_root);
  const backupStat = lstatSync(record.backup_root);
  if (isolatedStat.isSymbolicLink() || backupStat.isSymbolicLink() || !isolatedStat.isDirectory() || !backupStat.isDirectory()) fail("ISOLATED_ROOT_IDENTITY_MISMATCH", "allocated baseline root is not a directory");
}

function authorizedScope(record: InternalRecord, pathValue: string): DiffScope {
  const authorized = record.authorized_paths.get(pathValue);
  if (!authorized) return "out_of_scope";
  return authorized.role === "owned" ? "owned" : "authorized_read";
}

function gateValid(gate: RecoveryGate): boolean {
  return isRecord(gate) && gate.trusted_child_stopped === true && gate.caller_gate === "root_baseline_recovery" && validText(gate.child_stop_evidence_ref);
}

export function captureBaseline(request: BaselineRequest): BaselineHandle {
  const validated = validateRequest(request);
  const authorized = new Map(validated.paths.map((path) => [path.canonical_relative_path, path]));
  const capturedResult = captureEntries(validated.root, validated.paths, authorized);
  const manifest: SnapshotManifest = { entries: capturedResult.manifestEntries };
  const allocationRoot = mkdtempSync(resolve(tmpdir(), "jev-baseline-"));
  const isolatedRoot = resolve(allocationRoot, "workspace");
  const backupRoot = resolve(allocationRoot, "backup");
  try {
    mkdirSync(isolatedRoot, { mode: 0o700 });
    mkdirSync(backupRoot, { mode: 0o700 });
    materialize(isolatedRoot, backupRoot, capturedResult.captured, capturedResult.directoryModes);
    const handle = Object.freeze({}) as BaselineHandle;
    const sourceManifestDigest = digest(manifest);
    const snapshot: BaselineSnapshot = {
      source_root: validated.root,
      isolated_root: isolatedRoot,
      manifest,
      manifest_digest: sourceManifestDigest,
      input_digest: digest(manifest.entries.filter((entry) => entry.role === "input")),
      dependency_digest: digest(manifest.entries.filter((entry) => entry.role === "dependency"))
    };
    const initial = inventory(isolatedRoot).states;
    const baseline = new Map(initial);
    for (const entry of manifest.entries) if (entry.kind === "absent") baseline.set(entry.canonical_relative_path, { kind: "absent", mode: null, content_digest: null, symlink_target: null });
    const record: InternalRecord = {
      allocation_root: allocationRoot,
      allocation_identity: identity(allocationRoot),
      isolated_root: isolatedRoot,
      isolated_identity: identity(isolatedRoot),
      backup_root: backupRoot,
      backup_identity: identity(backupRoot),
      source_root: validated.root,
      authorized_paths: authorized,
      captured: capturedResult.captured,
      directory_modes: capturedResult.directoryModes,
      snapshot,
      baseline_states: baseline,
      baseline_manifest_digest: stateDigest(baseline),
      status: "active"
    };
    handles.set(handle as object, record);
    return handle;
  } catch (error) {
    rmSync(allocationRoot, { recursive: true, force: true });
    if (error instanceof BaselineError) throw error;
    throw new BaselineError("SOURCE_STATE_UNKNOWN", error instanceof Error ? error.message : "baseline capture failed");
  }
}

export function getBaselineSnapshot(handle: BaselineHandle): BaselineSnapshot {
  return structuredClone(ensureRecord(handle).snapshot);
}

export function diffBaseline(handle: BaselineHandle): OutputDiff {
  const record = ensureRecord(handle);
  ensureRoots(record);
  const current = inventory(record.isolated_root);
  const currentStates = current.states;
  const allPaths = new Set<string>([...record.baseline_states.keys(), ...currentStates.keys()]);
  const changes: OutputChange[] = [];
  const outOfScope = new Set<string>();
  for (const pathValue of [...allPaths].sort()) {
    const before = record.baseline_states.get(pathValue) ?? { kind: "absent", mode: null, content_digest: null, symlink_target: null } satisfies InternalState;
    const after = currentStates.get(pathValue) ?? { kind: "absent", mode: null, content_digest: null, symlink_target: null } satisfies InternalState;
    const changed = dimensions(before, after);
    if (changed.length === 0) continue;
    const scope = authorizedScope(record, pathValue);
    if (scope !== "owned") outOfScope.add(pathValue);
    changes.push({ canonical_relative_path: pathValue, scope, dimensions: changed, before: stateWithPath(pathValue, before), after: stateWithPath(pathValue, after) });
  }
  const outputManifestDigest = stateDigest(currentStates);
  return {
    baseline_manifest_digest: record.baseline_manifest_digest,
    output_manifest_digest: outputManifestDigest,
    changes,
    out_of_scope_paths: [...outOfScope].sort(),
    unsafe_symlink_paths: [...new Set(current.unsafe_symlinks)].sort(),
    has_out_of_scope_changes: outOfScope.size > 0 || current.unsafe_symlinks.length > 0,
    clean: changes.length === 0 && current.unsafe_symlinks.length === 0
  };
}

function clearWorkspace(root: string): void {
  for (const name of readdirSync(root)) rmSync(resolve(root, name), { recursive: true, force: false });
}

function restoreFromBackup(root: string, backupRoot: string, captured: CapturedPath[], directoryModes: DirectoryMode[]): void {
  clearWorkspace(root);
  ensureDirectories(root, directoryModes);
  for (const entry of captured.filter((item) => item.kind === "file")) {
    const pathValue = entry.requested.canonical_relative_path;
    ensureParent(root, pathValue, directoryModes);
    const backupPath = resolve(backupRoot, pathValue);
    const outputPath = resolve(root, pathValue);
    const bytes = readFileSync(backupPath);
    writeFileSync(outputPath, bytes, { mode: entry.mode ?? 0o600 });
    chmodSync(outputPath, entry.mode ?? 0o600);
  }
  for (const entry of captured.filter((item) => item.kind === "symlink")) {
    const targetPath = entry.symlink_target_path;
    if (!targetPath) fail("SOURCE_STATE_UNKNOWN", `safe symlink target disappeared: ${entry.requested.canonical_relative_path}`);
    const outputPath = resolve(root, entry.requested.canonical_relative_path);
    const outputTarget = resolve(root, targetPath);
    ensureParent(root, entry.requested.canonical_relative_path, directoryModes);
    symlinkSync(relative(posix.dirname(outputPath), outputTarget), outputPath);
  }
}

export function restoreBaseline(handle: BaselineHandle, gate: RecoveryGate): RecoveryResult {
  let record: InternalRecord;
  try { record = ensureRecord(handle); } catch (error) {
    return { ok: false, code: "INVALID_HANDLE", message: error instanceof Error ? error.message : "baseline handle is invalid" };
  }
  if (!gateValid(gate)) return { ok: false, code: "RECOVERY_GATE_REQUIRED", message: "trusted child-stopped evidence and the Root recovery gate are required" };
  try {
    ensureRoots(record);
    const beforeRestore = diffBaseline(handle);
    restoreFromBackup(record.isolated_root, record.backup_root, record.captured, record.directory_modes);
    ensureRoots(record);
    if (!diffBaseline(handle).clean) return { ok: false, code: "RECOVERY_FAILED", message: "restored workspace does not match the captured baseline" };
    return { ok: true, action: "restored", before_restore_diff: beforeRestore };
  } catch (error) {
    if (error instanceof BaselineError && error.code === "ISOLATED_ROOT_IDENTITY_MISMATCH") return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "RECOVERY_FAILED", message: error instanceof Error ? error.message : "baseline restore failed" };
  }
}

export function discardBaseline(handle: BaselineHandle, gate: RecoveryGate): RecoveryResult {
  let record: InternalRecord;
  try { record = ensureRecord(handle); } catch (error) {
    return { ok: false, code: "INVALID_HANDLE", message: error instanceof Error ? error.message : "baseline handle is invalid" };
  }
  if (!gateValid(gate)) return { ok: false, code: "RECOVERY_GATE_REQUIRED", message: "trusted child-stopped evidence and the Root recovery gate are required" };
  try {
    ensureRoots(record);
    rmSync(record.allocation_root, { recursive: true, force: false });
    record.status = "discarded";
    handles.delete(handle as object);
    return { ok: true, action: "discarded" };
  } catch (error) {
    if (error instanceof BaselineError && error.code === "ISOLATED_ROOT_IDENTITY_MISMATCH") return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "RECOVERY_FAILED", message: error instanceof Error ? error.message : "baseline discard failed" };
  }
}
