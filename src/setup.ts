import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_NODE_MAJOR = 22;
const COMMAND_TIMEOUT_MS = 3_000;
const MAX_OUTPUT_BYTES = 16 * 1024;
const NODE_INSTALL_URL = "https://nodejs.org/en/download";
const CODEX_CLI_URL = "https://developers.openai.com/codex/cli/";

export interface SetupCheck {
  ready: boolean;
  version: string;
  message: string;
  remediation: string;
  helpUrl?: string;
}

export interface SetupStatus {
  ready: boolean;
  node: SetupCheck;
  codex: SetupCheck;
  ccusage: SetupCheck;
}

function firstLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.split(/\r?\n/, 1)[0].trim().slice(0, 160);
}

function checkCommand(command: string, args: string[], missingMessage: string, remediation: string, options: { helpUrl?: string } = {}): SetupCheck {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES
    });
    const version = firstLine(result.stdout) || firstLine(result.stderr);
    if (!result.error && result.status === 0) {
      return { ready: true, version, message: version || `${command} responded successfully.`, remediation: "", helpUrl: options.helpUrl };
    }
  } catch {
    // A missing or broken prerequisite is represented as a check failure below.
  }
  return { ready: false, version: "", message: missingMessage, remediation, helpUrl: options.helpUrl };
}

function localCcusageVersion(): string {
  try {
    const packagePath = resolve(__dirname, "../..", "node_modules", "ccusage", "package.json");
    const metadata = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
    return typeof metadata.version === "string" ? metadata.version : "";
  } catch {
    return "";
  }
}

export function readSetupStatus(): SetupStatus {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeReady = Number.isFinite(nodeMajor) && nodeMajor >= REQUIRED_NODE_MAJOR;
  const node: SetupCheck = nodeReady
    ? { ready: true, version: process.version, message: `${process.version} (requires Node.js >=${REQUIRED_NODE_MAJOR})`, remediation: "" }
    : { ready: false, version: process.version, message: `${process.version} is below the required Node.js ${REQUIRED_NODE_MAJOR}.`, remediation: "Install Node.js 22+, then rerun npm run setup.", helpUrl: NODE_INSTALL_URL };
  const codex = checkCommand(
    "codex",
    ["--version"],
    "Codex CLI was not found in this shell.",
    "Install Codex CLI, sign in with codex, then rerun npm run setup.",
    { helpUrl: CODEX_CLI_URL }
  );
  const localVersion = localCcusageVersion();
  const ccusage: SetupCheck = localVersion
    ? { ready: true, version: `ccusage ${localVersion}`, message: `Project-local ccusage ${localVersion} is ready.`, remediation: "" }
    : { ready: false, version: "", message: "The project-local ccusage package is missing.", remediation: "Run npm ci, then rerun npm run setup." };
  return { ready: node.ready && codex.ready && ccusage.ready, node, codex, ccusage };
}
