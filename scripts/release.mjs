import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) fail(`command failed: ${command} ${args.join(" ")}`);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) fail(`command failed: ${command} ${args.join(" ")}`);
  return result.stdout.trim();
}

function bumpVersionField(path, nextVersion) {
  const text = readFileSync(path, "utf8");
  const match = text.match(/"version":\s*"(\d+\.\d+\.\d+)"/);
  if (!match) fail(`no "version" field found in ${path}`);
  const updated = text.replace(match[0], `"version": "${nextVersion}"`);
  writeFileSync(path, updated);
  return match[1];
}

const nextVersion = process.argv[2];
if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  fail("usage: node scripts/release.mjs <X.Y.Z>");
}

const tag = `v${nextVersion}`;
if (capture("git", ["status", "--porcelain"]) !== "") {
  fail("the working tree is not clean. Commit or stash pending changes first.");
}
if (capture("git", ["tag", "--list", tag]) !== "") {
  fail(`tag ${tag} already exists.`);
}

const packagePath = "package.json";
const pluginManifestPath = ".codex-plugin/plugin.json";
const currentVersion = bumpVersionField(packagePath, nextVersion);
if (currentVersion === nextVersion) fail(`package.json is already at ${nextVersion}.`);
bumpVersionField(pluginManifestPath, nextVersion);

console.log(`release: ${currentVersion} -> ${nextVersion}`);
run("npm", ["run", "build"]);
run("node", ["--test", "dist/test/policy.test.js"]);

run("git", ["add", packagePath, pluginManifestPath]);
run("git", ["commit", "-m", `release: ${tag}`]);
run("git", ["tag", "-a", tag, "-m", tag]);

console.log(`release: committed and tagged ${tag} locally.`);
console.log(`release: push it yourself when ready: git push && git push origin ${tag}`);
