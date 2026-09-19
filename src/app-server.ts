import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { CreditRateLimit, OfficialRateLimit, OfficialSnapshot, ReadinessDiagnostic, SubscriptionRateLimit } from "./types.js";
import { subtractCredits } from "./credit.js";

const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_LINE_BYTES = 32 * 1024;
const READ_TIMEOUT_MS = 8_000;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDecimal(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function normalizeReset(value: unknown): string | undefined {
  if (!finiteNumber(value) || value < 0) return undefined;
  const date = new Date(value * 1_000);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function normalizeCredit(value: unknown): CreditRateLimit | undefined {
  const candidate = asRecord(value);
  const rate = asRecord(candidate?.individualLimit);
  if (!rate || !isDecimal(rate.limit) || !isDecimal(rate.used) || !finiteNumber(rate.remainingPercent)) return undefined;
  const resetsAt = normalizeReset(rate.resetsAt);
  const remaining = subtractCredits(rate.limit, rate.used);
  if (resetsAt === undefined || remaining === undefined) return undefined;
  return {
    kind: "credit",
    source: "individualLimit",
    limit: rate.limit,
    used: rate.used,
    remaining,
    remainingPercent: rate.remainingPercent,
    resetsAt
  };
}

function normalizeSubscription(value: unknown, response: Record<string, unknown>): SubscriptionRateLimit | undefined {
  const rates = asRecord(value);
  const primary = asRecord(rates?.primary);
  const usedPercent = primary?.usedPercent;
  const windowDurationMins = primary?.windowDurationMins;
  if (!primary || !finiteNumber(usedPercent) || usedPercent < 0 || usedPercent > 100) return undefined;
  if (typeof windowDurationMins !== "number" || !Number.isSafeInteger(windowDurationMins) || windowDurationMins <= 0) return undefined;
  const resetsAt = normalizeReset(primary.resetsAt);
  const planTypeValue = primary.planType ?? rates?.planType ?? response.planType;
  if (resetsAt === undefined) return undefined;
  return {
    kind: "subscription-quota",
    source: "primary",
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowDurationMins,
    resetsAt,
    ...(typeof planTypeValue === "string" && planTypeValue.length > 0 ? { planType: planTypeValue } : {})
  };
}

export function normalizeRateLimits(value: unknown): OfficialRateLimit | undefined {
  const response = asRecord(value);
  if (!response) return undefined;
  const byId = asRecord(response.rateLimitsByLimitId);
  const preferred = byId?.codex;
  const preferredCredit = normalizeCredit(preferred);
  if (preferredCredit) return preferredCredit;
  const preferredSubscription = normalizeSubscription(preferred, response);
  if (preferredSubscription) return preferredSubscription;
  const rates = asRecord(response.rateLimits);
  return normalizeCredit(rates) ?? normalizeSubscription(rates, response);
}

export function hasValidUsage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const summary = response.summary;
  const summaryFields = ["lifetimeTokens", "peakDailyTokens", "longestRunningTurnSec", "currentStreakDays", "longestStreakDays"];
  const validSummary = Boolean(summary && typeof summary === "object")
    && summaryFields.every((field) => {
      const entry = (summary as Record<string, unknown>)[field];
      return entry === null || finiteNumber(entry);
    });
  const buckets = response.dailyUsageBuckets;
  return validSummary
    && Array.isArray(buckets)
    && buckets.length > 0
    && buckets.every((bucket) => Boolean(bucket && typeof bucket === "object")
      && typeof (bucket as Record<string, unknown>).startDate === "string"
      && finiteNumber((bucket as Record<string, unknown>).tokens));
}

function stopChild(child: ChildProcessWithoutNullStreams): void {
  child.stdin.end();
  const fallback = setTimeout(() => child.kill(), 250);
  fallback.unref();
}

function unavailable(code: ReadinessDiagnostic["code"], message: string, remediation: string): OfficialSnapshot {
  return { usageAvailable: false, diagnostic: { source: "official", code, message, remediation } };
}

export async function readOfficialSnapshot(): Promise<OfficialSnapshot> {
  return new Promise((resolve) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn("codex", ["app-server", "--listen", "stdio://"], { shell: false, stdio: "pipe" });
    } catch {
      resolve(unavailable("codex-missing", "Official usage could not start because Codex was not found.", "Install or repair the Codex CLI, then run npm run setup."));
      return;
    }
    let buffer = "";
    let bytes = 0;
    let initialized = false;
    let rateLimit: OfficialRateLimit | undefined;
    let usageAvailable = false;
    let rateRead = false;
    let usageRead = false;
    let completed = false;
    const finish = (diagnostic?: ReadinessDiagnostic): void => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      stopChild(child);
      resolve({ rateLimit, usageAvailable, diagnostic });
    };
    const timer = setTimeout(() => finish({ source: "official", code: "read-timeout", message: "Official usage did not respond within 8 seconds.", remediation: "Restart or update Codex, then retry." }), READ_TIMEOUT_MS);
    timer.unref();
    const send = (message: object): void => { child.stdin.write(`${JSON.stringify(message)}\n`); };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (completed) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_OUTPUT_BYTES) return finish({ source: "official", code: "invalid-response", message: "Official usage returned an invalid response.", remediation: "Restart or update Codex, then retry." });
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (Buffer.byteLength(line) > MAX_LINE_BYTES) return finish({ source: "official", code: "invalid-response", message: "Official usage returned an invalid response.", remediation: "Restart or update Codex, then retry." });
        try {
          const message = JSON.parse(line) as { id?: number; result?: unknown };
          if (message.id === 1 && !initialized) {
            initialized = true;
            send({ method: "initialized" });
            send({ id: 2, method: "account/rateLimits/read" });
            send({ id: 3, method: "account/usage/read" });
          } else if (message.id === 2) {
            rateRead = true;
            rateLimit = normalizeRateLimits(message.result);
          } else if (message.id === 3) {
            usageRead = true;
            usageAvailable = hasValidUsage(message.result);
          }
          if (initialized && rateRead && usageRead) finish(rateLimit ? undefined : { source: "official", code: "no-usage", message: "Codex did not return current usage data for this account.", remediation: "Confirm you are signed in to Codex, then retry." });
        } catch {
          finish({ source: "official", code: "invalid-response", message: "Official usage returned an invalid response.", remediation: "Restart or update Codex, then retry." });
        }
        newline = buffer.indexOf("\n");
      }
      if (Buffer.byteLength(buffer) > MAX_LINE_BYTES) finish({ source: "official", code: "invalid-response", message: "Official usage returned an invalid response.", remediation: "Restart or update Codex, then retry." });
    });
    child.stderr.resume();
    child.once("error", (error: NodeJS.ErrnoException) => finish({ source: "official", code: error.code === "ENOENT" ? "codex-missing" : "unavailable", message: error.code === "ENOENT" ? "Official usage could not start because Codex was not found." : "Official usage could not be read.", remediation: error.code === "ENOENT" ? "Install or repair the Codex CLI, then run npm run setup." : "Restart Codex and retry." }));
    child.once("close", () => finish({ source: "official", code: "unavailable", message: "Official usage could not be read.", remediation: "Restart Codex and retry." }));
    send({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: { name: "jev-auto-router", title: null, version: "0.1.0" },
        capabilities: { experimentalApi: true, requestAttestation: false }
      }
    });
  });
}
