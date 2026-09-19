import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BaselineError,
  captureBaseline,
  diffBaseline,
  discardBaseline,
  getBaselineSnapshot,
  restoreBaseline,
  type AuthorizedPath,
  type BaselineHandle,
  type RecoveryGate
} from "../src/baseline.js";

const gate: RecoveryGate = {
  trusted_child_stopped: true,
  caller_gate: "root_baseline_recovery",
  child_stop_evidence_ref: "stop-evidence"
};

function fixture(): { root: string; paths: AuthorizedPath[] } {
  const root = mkdtempSync(join(tmpdir(), "jev-baseline-test-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(root, "src", "b.ts"), "export const b = 2;\n");
  chmodSync(join(root, "src", "b.ts"), 0o640);
  writeFileSync(join(root, "notes.txt"), "dirty untracked notes\n");
  symlinkSync("a.ts", join(root, "src", "link.ts"));
  return {
    root,
    paths: [
      { canonical_relative_path: "src/a.ts", existing_or_new: "existing", role: "owned" },
      { canonical_relative_path: "src/b.ts", existing_or_new: "existing", role: "owned" },
      { canonical_relative_path: "src/new.ts", existing_or_new: "new", role: "owned" },
      { canonical_relative_path: "src/link.ts", existing_or_new: "existing", role: "owned" },
      { canonical_relative_path: "notes.txt", existing_or_new: "existing", role: "input" }
    ]
  };
}

test("capture materializes dirty, untracked, mode and symlink state in isolation", () => {
  const { root, paths } = fixture();
  const handle = captureBaseline({ source_root: root, authorized_paths: paths });
  const snapshot = getBaselineSnapshot(handle);
  const entries = new Map(snapshot.manifest.entries.map((entry) => [entry.canonical_relative_path, entry]));
  assert.equal(entries.size, 5);
  assert.equal(entries.get("src/new.ts")?.kind, "absent");
  assert.equal(entries.get("src/b.ts")?.mode, 0o640);
  assert.equal(entries.get("src/link.ts")?.kind, "symlink");
  assert.equal(entries.get("src/link.ts")?.symlink_target_path, "src/a.ts");
  assert.notEqual(snapshot.input_digest, snapshot.dependency_digest);
  assert.match(snapshot.input_digest, /^[0-9a-f]{64}$/);
  const isolated = snapshot.isolated_root;
  assert.equal(readFileSync(join(isolated, "src", "a.ts"), "utf8"), "export const a = 1;\n");
  assert.equal(lstatSync(join(isolated, "src", "b.ts")).mode & 0o7777, 0o640);
  assert.equal(readFileSync(join(isolated, "notes.txt"), "utf8"), "dirty untracked notes\n");
  assert.equal(readlinkSync(join(isolated, "src", "link.ts")), "a.ts");
  assert.equal(lstatSync(join(isolated, "src", "new.ts"), { throwIfNoEntry: false }), undefined);
  assert.equal(lstatSync(join(root, "src", "new.ts"), { throwIfNoEntry: false }), undefined);
  discardBaseline(handle, gate);
});

test("diff reports owned content/mode changes and rejects out-of-scope output", () => {
  const { root, paths } = fixture();
  const handle = captureBaseline({ source_root: root, authorized_paths: paths });
  const isolated = getBaselineSnapshot(handle).isolated_root;
  assert.equal(diffBaseline(handle).clean, true);
  writeFileSync(join(isolated, "src", "a.ts"), "export const a = 99;\n");
  chmodSync(join(isolated, "src", "b.ts"), 0o600);
  let diff = diffBaseline(handle);
  const changed = new Map(diff.changes.map((change) => [change.canonical_relative_path, change]));
  assert.deepEqual(changed.get("src/a.ts")?.dimensions, ["content"]);
  assert.equal(changed.get("src/a.ts")?.scope, "owned");
  assert.deepEqual(changed.get("src/b.ts")?.dimensions, ["mode"]);
  assert.equal(diff.has_out_of_scope_changes, false);
  assert.equal(diff.clean, false);
  writeFileSync(join(isolated, "escape.txt"), "not authorized\n");
  diff = diffBaseline(handle);
  assert.deepEqual(diff.out_of_scope_paths, ["escape.txt"]);
  assert.equal(diff.has_out_of_scope_changes, true);
  discardBaseline(handle, gate);
});

test("diff flags symlinks that escape the isolated workspace", () => {
  const { root, paths } = fixture();
  const handle = captureBaseline({ source_root: root, authorized_paths: paths });
  const isolated = getBaselineSnapshot(handle).isolated_root;
  symlinkSync("/etc/hosts", join(isolated, "danger"));
  const diff = diffBaseline(handle);
  assert.deepEqual(diff.unsafe_symlink_paths, ["danger"]);
  assert.equal(diff.has_out_of_scope_changes, true);
  discardBaseline(handle, gate);
});

test("restore recovers only the isolated workspace and leaves shared checkout edits intact", () => {
  const { root, paths } = fixture();
  const handle = captureBaseline({ source_root: root, authorized_paths: paths });
  const isolated = getBaselineSnapshot(handle).isolated_root;
  writeFileSync(join(isolated, "src", "a.ts"), "worker patch\n");
  writeFileSync(join(isolated, "escape.txt"), "out of scope\n");
  rmSync(join(isolated, "src", "b.ts"));
  writeFileSync(join(root, "src", "a.ts"), "concurrent checkout edit\n");
  const result = restoreBaseline(handle, gate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.action, "restored");
  assert.ok((result.before_restore_diff?.changes.length ?? 0) >= 2);
  assert.equal(readFileSync(join(isolated, "src", "a.ts"), "utf8"), "export const a = 1;\n");
  assert.equal(lstatSync(join(isolated, "src", "b.ts")).mode & 0o7777, 0o640);
  assert.equal(lstatSync(join(isolated, "escape.txt"), { throwIfNoEntry: false }), undefined);
  assert.equal(diffBaseline(handle).clean, true);
  assert.equal(readFileSync(join(root, "src", "a.ts"), "utf8"), "concurrent checkout edit\n");
  assert.equal(lstatSync(join(root, "src", "new.ts"), { throwIfNoEntry: false }), undefined);
  discardBaseline(handle, gate);
});

test("recovery requires trusted stop evidence and a valid live handle", () => {
  const { root, paths } = fixture();
  const handle = captureBaseline({ source_root: root, authorized_paths: paths });
  const invalidGate = { ...gate, trusted_child_stopped: false } as unknown as RecoveryGate;
  assert.deepEqual(restoreBaseline(handle, invalidGate), {
    ok: false,
    code: "RECOVERY_GATE_REQUIRED",
    message: "trusted child-stopped evidence and the Root recovery gate are required"
  });
  assert.equal(restoreBaseline({} as BaselineHandle, gate).ok, false);
  assert.equal(discardBaseline(handle, gate).ok, true);
  assert.equal(discardBaseline(handle, gate).ok, false);
  assert.throws(() => getBaselineSnapshot(handle), BaselineError);
});

test("capture rejects ambiguous, overlapping, non-owned-new and escaping inputs", () => {
  const { root, paths } = fixture();
  assert.throws(
    () => captureBaseline({ source_root: root, authorized_paths: [{ ...paths[0], existing_or_new: "new" }] }),
    /INVALID_REQUEST/
  );
  assert.throws(
    () => captureBaseline({ source_root: root, authorized_paths: [...paths, { canonical_relative_path: "src", existing_or_new: "existing", role: "owned" }] }),
    /INVALID_REQUEST/
  );
  assert.throws(
    () => captureBaseline({
      source_root: root,
      authorized_paths: [...paths, { canonical_relative_path: "src/A.TS", existing_or_new: "existing", role: "owned" }]
    }),
    /INVALID_REQUEST/
  );
  writeFileSync(join(root, "outside.txt"), "outside\n");
  symlinkSync("../../outside.txt", join(root, "src", "escape.ts"));
  assert.throws(
    () => captureBaseline({
      source_root: root,
      authorized_paths: [...paths, { canonical_relative_path: "src/escape.ts", existing_or_new: "existing", role: "owned" }]
    }),
    /INVALID_REQUEST/
  );
  writeFileSync(join(root, "other.txt"), "not authorized\n");
  symlinkSync("../other.txt", join(root, "src", "unauthorized.ts"));
  assert.throws(
    () => captureBaseline({
      source_root: root,
      authorized_paths: [...paths, { canonical_relative_path: "src/unauthorized.ts", existing_or_new: "existing", role: "owned" }]
    }),
    /INVALID_REQUEST/
  );
});
