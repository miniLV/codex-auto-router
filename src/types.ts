import type { SetupStatus } from "./setup.js";

/** A legacy Codex `individualLimit` allowance expressed as credit units. */
export interface CreditRateLimit {
  kind: "credit";
  source: "individualLimit";
  limit: string;
  used: string;
  remaining: string;
  remainingPercent: number;
  resetsAt: string;
}

/** The current subscription window returned by `account/rateLimits/read`. */
export interface SubscriptionRateLimit {
  kind: "subscription-quota";
  source: "primary";
  usedPercent: number;
  remainingPercent: number;
  windowDurationMins: number;
  resetsAt: string;
  planType?: string;
}

export type OfficialRateLimit = CreditRateLimit | SubscriptionRateLimit;

export type OfficialCredit =
  | ({ status: "available" } & OfficialRateLimit)
  | { status: "unavailable" };

export interface UsageViewModel {
  observationWindow: ObservationWindow;
  officialCredit: OfficialCredit;
  estimatedCreditAttribution: Array<{ model: string; credits: string; share: number }>;
  /** Local model-token shares retained when the official source has no credit amount. */
  localModelShare?: Array<{ model: string; share: number }>;
  localUsageSummary: { modelCount: number; tokenCount: number };
  attributionQuality: { status: "estimated" | "unavailable"; message: string };
  diagnostics: ReadinessDiagnostic[];
  setupStatus?: SetupStatus;
}

export interface ReadinessDiagnostic {
  source: "official" | "local";
  code: "codex-missing" | "ccusage-missing" | "read-timeout" | "invalid-response" | "unavailable" | "no-usage";
  message: string;
  remediation: string;
}

export interface SnapshotProvider {
  refresh(): Promise<UsageViewModel>;
}

export interface OfficialSnapshot {
  rateLimit?: OfficialRateLimit;
  usageAvailable: boolean;
  diagnostic?: ReadinessDiagnostic;
}

export interface LocalUsage {
  models: Array<{ model: string; tokens: number }>;
  skippedEntries: number;
  diagnostic?: ReadinessDiagnostic;
}

export interface ObservationWindow {
  since: string;
  until: string;
  timezone: string;
}
