import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readSetupStatus } from "./setup.js";
import type { SnapshotProvider, UsageViewModel } from "./types.js";

const MODEL_COLORS = ["#d76838", "#20898d", "#3867d6", "#d35f84", "#3f8f52", "#e8c547"];
const DONUT_RADIUS = 76;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_GAP = 2;

function setSecurityHeaders(response: ServerResponse, nonce: string): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-security-policy", `default-src 'none'; connect-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
}

function writeJson(response: ServerResponse, status: number, value: object): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string);
}

function formatCredit(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  return `${match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${match[2] ? `.${match[2]}` : ""}`;
}

function boundedPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function percent(value: number): string {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`;
}

function quotaPercent(value: number): string {
  return `${boundedPercent(value).toFixed(1)}%`;
}

function quotaWindowLabel(windowDurationMins: number): string {
  if (windowDurationMins === 10_080) return "Weekly";
  if (windowDurationMins === 1_440) return "Daily";
  if (windowDurationMins === 60) return "Hourly";
  if (windowDurationMins === 15) return "15-minute";
  if (windowDurationMins >= 1_440 && windowDurationMins % 1_440 === 0) return `${windowDurationMins / 1_440}-day`;
  if (windowDurationMins >= 60 && windowDurationMins % 60 === 0) return `${windowDurationMins / 60}-hour`;
  return `${windowDurationMins}-minute`;
}

function rankedRows(view: UsageViewModel): Array<{ model: string; share: number; credits?: string }> {
  const rows = view.estimatedCreditAttribution.length > 0
    ? view.estimatedCreditAttribution
    : (view.localModelShare ?? []).map((row) => ({ ...row }));
  return [...rows].sort((left, right) => right.share - left.share || left.model.localeCompare(right.model));
}

function resetProgress(resetsAt: string, periodStart: string): { countdown: string; remainingPercent: number } {
  const resetAt = Date.parse(resetsAt);
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  if (!Number.isFinite(resetAt) || !Number.isFinite(start) || resetAt <= start) return { countdown: "—", remainingPercent: 0 };
  const now = Date.now();
  const remainingMinutes = Math.max(0, Math.ceil((resetAt - now) / 60_000));
  return {
    countdown: remainingMinutes === 0 ? "Reset due" : `${Math.floor(remainingMinutes / 1_440)}d ${Math.floor((remainingMinutes % 1_440) / 60)}h ${remainingMinutes % 60}m`,
    remainingPercent: Math.max(0, Math.min(100, ((resetAt - now) / (resetAt - start)) * 100))
  };
}

function quotaResetProgress(resetsAt: string, windowDurationMins: number): { countdown: string; remainingPercent: number } {
  const resetAt = Date.parse(resetsAt);
  if (!Number.isFinite(resetAt) || !Number.isFinite(windowDurationMins) || windowDurationMins <= 0) return { countdown: "—", remainingPercent: 0 };
  const start = resetAt - windowDurationMins * 60_000;
  const now = Date.now();
  const remainingMinutes = Math.max(0, Math.ceil((resetAt - now) / 60_000));
  return {
    countdown: remainingMinutes === 0 ? "Reset due" : `${Math.floor(remainingMinutes / 1_440)}d ${Math.floor((remainingMinutes % 1_440) / 60)}h ${remainingMinutes % 60}m`,
    remainingPercent: Math.max(0, Math.min(100, ((resetAt - now) / (resetAt - start)) * 100))
  };
}

function donutArcs(view: UsageViewModel): string {
  let offset = 0;
  return rankedRows(view).map((row, index) => {
    const length = Math.max(0, Math.min(1, row.share)) * DONUT_CIRCUMFERENCE;
    const visibleLength = Math.max(0, length - DONUT_GAP);
    const color = MODEL_COLORS[index % MODEL_COLORS.length];
    const arc = visibleLength > 0
      ? `<circle class="donut-arc" data-model="${escapeHtml(row.model)}" data-share="${percent(row.share)}" tabindex="0" role="img" aria-label="${escapeHtml(row.model)}: ${percent(row.share)} of locally observed model-token share" cx="100" cy="100" r="${DONUT_RADIUS}" stroke="${color}" stroke-dasharray="${visibleLength} ${DONUT_CIRCUMFERENCE - visibleLength}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`
      : "";
    offset += length;
    return arc;
  }).join("");
}

function modelList(view: UsageViewModel): string {
  if (view.estimatedCreditAttribution.length === 0 && (view.localModelShare ?? []).length === 0) return "<p class=\"empty-state\">No local model attribution is available for this period.</p>";
  return rankedRows(view).map((row, index) => {
    const credit = row.credits ? `${escapeHtml(formatCredit(row.credits))}<small> CR est.</small>` : `${percent(row.share)}<small> share</small>`;
    const description = row.credits ? `estimated ${escapeHtml(formatCredit(row.credits))} credit` : `${percent(row.share)} of local token share`;
    return `<div class="model-row" data-model="${escapeHtml(row.model)}" data-share="${percent(row.share)}" tabindex="0" aria-label="${escapeHtml(row.model)}: ${description}"><span class="model-swatch" data-color="${index % MODEL_COLORS.length}"></span><span class="model-name">${escapeHtml(row.model)}</span><span class="model-share">${percent(row.share)}</span><strong>${credit}</strong></div>`;
  }).join("");
}

function formatTokens(value: number): string {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("en-US") : String(value);
}

function taskLabel(lastActivity: string): string {
  const at = Date.parse(lastActivity);
  return Number.isFinite(at) ? `${new Date(at).toISOString().replace("T", " ").slice(0, 16)} UTC` : lastActivity;
}

function taskTable(view: UsageViewModel): string {
  const tasks = view.localTaskUsage ?? [];
  if (tasks.length === 0) return "<p class=\"empty-state\">No per-task usage is available for this period.</p>";
  const rows = tasks.map((task) => {
    const breakdown = task.models.map((entry) => `<span class="task-model"><b>${escapeHtml(entry.model)}</b> ${formatTokens(entry.tokens)}</span>`).join("");
    return `<tr><td class="task-when">${escapeHtml(taskLabel(task.lastActivity))}</td><td>${breakdown}</td><td class="task-total">${formatTokens(task.tokens)}</td></tr>`;
  }).join("");
  return `<table class="task-table"><thead><tr><th scope="col">Last activity</th><th scope="col">Models · tokens</th><th scope="col">Task total</th></tr></thead><tbody>${rows}</tbody></table><p class="task-note">One Codex session ≈ one task · most recent first · from local session logs, prompts excluded.</p>`;
}

function loadingDebugLog(): string[] {
  return [
    `[loading] Dashboard request started at ${new Date().toISOString()}.`,
    "[loading] Waiting for snapshot provider (official subscription usage + local model usage)…"
  ];
}

function snapshotDebugLog(view: UsageViewModel, elapsedMs: number, failure?: string): string[] {
  const outcome = failure
    ? "[error] Snapshot provider failed"
    : view.officialCredit.status === "unavailable"
      ? "[warn] Snapshot provider completed with unavailable official usage"
      : "[ok] Snapshot provider completed";
  const lines = [
    `${outcome} after ${elapsedMs}ms.`,
    `[info] Official usage: ${view.officialCredit.status}${view.officialCredit.status === "available" ? ` (${view.officialCredit.kind})` : ""}.`,
    `[info] Local model mix: ${view.localUsageSummary.modelCount} models, ${view.localUsageSummary.tokenCount} tokens.`,
    `[info] Local tasks: ${(view.localTaskUsage ?? []).length} session${(view.localTaskUsage ?? []).length === 1 ? "" : "s"} in the task table.`
  ];
  if (failure) lines.push(`[error] ${failure}`);
  for (const diagnostic of view.diagnostics ?? []) lines.push(`[${diagnostic.source === "official" ? "warn" : "info"}] ${diagnostic.message} ${diagnostic.remediation}`.trim());
  return lines;
}

function errorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/\s+/g, " ").trim().slice(0, 300) || "Unknown dashboard error.";
}

function setupStatusBlock(view: UsageViewModel): string {
  const loading = view.observationWindow.since === "Loading";
  if (loading && !view.setupStatus) {
    return `<section id="dashboard-setup" class="readiness setup-status is-ready" aria-live="polite"><span>Checking setup…</span></section>`;
  }
  const status = view.setupStatus ?? readSetupStatus();
  if (status.ready) {
    return `<section id="dashboard-setup" class="readiness setup-status is-ready" aria-live="polite"><strong>🟢 Setup ready</strong><span>Node.js ${escapeHtml(status.node.version)} · Codex CLI ${escapeHtml(status.codex.version)} · ${escapeHtml(status.ccusage.version)}</span></section>`;
  }
  const row = (label: string, check: ReturnType<typeof readSetupStatus>["node"]): string => {
    const link = check.helpUrl
      ? ` <a class="setup-link" href="${escapeHtml(check.helpUrl)}" target="_blank" rel="noopener noreferrer">Installation guide</a>`
      : "";
    return `<p class="setup-item"><b>${label}:</b> 🔴 ${escapeHtml(check.message)} ${escapeHtml(check.remediation)}${link}</p>`;
  };
  const checks: Array<[string, ReturnType<typeof readSetupStatus>["node"]]> = [["Node.js", status.node], ["Codex CLI", status.codex], ["ccusage", status.ccusage]];
  const issues = checks
    .filter(([, check]) => !check.ready)
    .map(([label, check]) => row(label, check))
    .join("");
  const count = checks.filter(([, check]) => !check.ready).length;
  return `<section id="dashboard-setup" class="readiness setup-status has-issues" aria-live="polite"><strong>Setup status · 🔴 ${count} action${count === 1 ? "" : "s"} needed</strong>${issues}</section>`;
}

function html(view: UsageViewModel, nonce: string, loading = false, debugLines?: string[]): string {
  const diagnostics = view.diagnostics ?? [];
  const officialUsage = view.officialCredit.status === "available" ? view.officialCredit : undefined;
  const subscriptionQuota = officialUsage?.kind === "subscription-quota" ? officialUsage : undefined;
  const creditUsage = officialUsage?.kind === "credit" ? officialUsage : undefined;
  const rows = rankedRows(view);
  const top = rows[0];
  const used = creditUsage ? formatCredit(creditUsage.used) : "—";
  const remaining = creditUsage ? formatCredit(creditUsage.remaining) : "—";
  const usedPercent = subscriptionQuota ? boundedPercent(subscriptionQuota.usedPercent) : creditUsage ? boundedPercent(100 - creditUsage.remainingPercent) : 0;
  const reset = subscriptionQuota
    ? quotaResetProgress(subscriptionQuota.resetsAt, subscriptionQuota.windowDurationMins)
    : creditUsage
      ? resetProgress(creditUsage.resetsAt, view.observationWindow.since)
      : undefined;
  const period = `${view.observationWindow.since} – ${view.observationWindow.until} UTC`;
  const billingSource = subscriptionQuota ? "Subscription" : creditUsage ? "Credit" : "Unavailable";
  const billingDescription = subscriptionQuota ? "Codex usage quota · API token usage is separate." : creditUsage ? "Codex Credit · API token usage is separate." : "Official usage is unavailable.";
  const usageTitle = subscriptionQuota ? "Subscription usage" : creditUsage ? "Official Credit" : "Official usage";
  const logEntries = debugLines ?? (loading ? loadingDebugLog() : snapshotDebugLog(view, 0));
  const dynamicStyles = `${MODEL_COLORS.map((color, index) => `.model-swatch[data-color="${index}"]{background:${color}}`).join("")}${officialUsage ? `.usage-progress span{transform:scaleX(${usedPercent / 100})}.reset-progress span{transform:scaleX(${1 - (reset?.remainingPercent ?? 0) / 100})}` : ""}.readiness.is-empty{display:none}.setup-status.is-ready{display:flex;gap:8px;margin-top:14px;padding:0 2px;border:0;background:transparent;box-shadow:none;color:var(--muted)}.setup-status.has-issues{border-color:var(--orange);background:#fff1a8}.setup-item{margin:5px 0 0}.setup-link{color:var(--blue);font-weight:800;text-decoration:underline}.debug-log-panel{margin-top:18px;border-color:var(--ink);background:var(--panel)}.debug-log-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.debug-log{max-height:220px;overflow:auto;margin:10px 0 0;padding:10px;border:1px solid rgba(31,35,40,.2);border-radius:8px;background:rgba(31,35,40,.04);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.debug-log:focus{outline:2px solid var(--blue);outline-offset:2px}.debug-log-panel .debug{margin-top:10px}.debug-log-panel .debug-copy{padding:6px 9px;font-size:11px}.task-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}.task-table th{text-align:left;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;padding:0 8px 4px 0}.task-table td{padding:5px 8px 5px 0;border-top:1px solid rgba(31,35,40,.14);vertical-align:top}.task-table .task-when{white-space:nowrap;font-weight:600}.task-table .task-total{text-align:right;white-space:nowrap;font-weight:800}.task-model{display:inline-block;margin:0 12px 0 0}.task-model b{font-weight:800}.task-note{color:var(--muted);font-size:12px;margin:8px 0 0}`;
  const official = subscriptionQuota
    ? `<div class="hero-value">${quotaPercent(subscriptionQuota.remainingPercent)} <small>remaining</small></div><p>${escapeHtml(subscriptionQuota.planType ? `${subscriptionQuota.planType} plan` : "ChatGPT subscription")} · ${quotaWindowLabel(subscriptionQuota.windowDurationMins)} quota window</p><div class="progress-label"><span>Usage · ${quotaPercent(subscriptionQuota.usedPercent)}</span><strong>${quotaPercent(subscriptionQuota.remainingPercent)} remaining</strong></div><div class="progress-cue"><div class="progress usage-progress"><span></span></div></div><div class="split"><span>Window <b>${quotaWindowLabel(subscriptionQuota.windowDurationMins)}</b></span><span>Reset <b>${escapeHtml(reset?.countdown ?? "—")}</b></span></div><div class="progress-label reset-label"><span>Time to reset</span><strong>${escapeHtml(reset?.countdown ?? "—")}</strong></div><div class="progress-cue"><div class="progress reset-progress"><span></span></div><span class="progress-note">${reset?.remainingPercent.toFixed(1) ?? "0"}% of window remaining</span></div>`
    : creditUsage
      ? `<div class="hero-value">${escapeHtml(used)} <small>CR</small></div><p>of ${escapeHtml(formatCredit(creditUsage.limit))} CR current-cycle limit</p><div class="progress-label"><span>Credit used · ${usedPercent.toFixed(1)}%</span><strong>${creditUsage.remainingPercent.toFixed(1)}% remaining</strong></div><div class="progress-cue"><div class="progress usage-progress"><span></span></div></div><div class="split"><span>Remaining <b>${escapeHtml(remaining)} CR</b></span><span>Reset <b>${escapeHtml(reset?.countdown ?? "—")}</b></span></div><div class="progress-label reset-label"><span>Time to reset</span><strong>${escapeHtml(reset?.countdown ?? "—")}</strong></div><div class="progress-cue"><div class="progress reset-progress"><span></span></div><span class="progress-note">${reset?.remainingPercent.toFixed(1) ?? "0"}% remaining</span></div>`
      : "<p class=\"empty-state\">Official subscription usage is unavailable.</p>";
  const modelMix = rows.length > 0
    ? `<div class="board"><div class="chart"><svg id="model-donut" viewBox="0 0 200 200" role="img" aria-label="Local model token share by model"><circle class="donut-track" cx="100" cy="100" r="${DONUT_RADIUS}"/>${donutArcs(view)}</svg><div class="donut-center"><span>Top local share</span><strong id="donut-model">${escapeHtml(top?.model ?? "—")}</strong><em id="donut-share">${percent(top?.share ?? 0)}</em></div></div><div class="model-list">${modelList(view)}</div></div>`
    : "<p class=\"empty-state\">No local model attribution is available for this period.</p>";
  const insight = top
    ? `<strong>${escapeHtml(top.model)}</strong> represents <strong>${percent(top.share)}</strong> of the locally observed model-token share in this period.`
    : "A concentration insight appears when local model attribution is available.";
  const summary = loading
    ? `<section id="dashboard-summary" class="summary" aria-live="polite"><article class="note-card"><span class="note-label">Attribution period</span><strong>Loading…</strong><p>Reading local session data.</p></article><article class="note-card"><span class="note-label">Official source</span><strong>Loading…</strong><p>Reading current subscription usage.</p></article><article class="note-card"><span class="note-label">Model mix</span><strong>Loading…</strong><p>Preparing the local estimate.</p></article></section>`
    : `<section id="dashboard-summary" class="summary"><article class="note-card"><span class="note-label">Attribution period</span><strong>${escapeHtml(period)}</strong><p>Codex local sessions · UTC calendar boundary</p></article><article class="note-card"><span class="note-label">Billing source</span><strong>${billingSource}</strong><p>${billingDescription}</p></article><article class="note-card"><span class="note-label">Top local share</span><strong>${escapeHtml(top?.model ?? "—")}</strong><p>${percent(top?.share ?? 0)} of locally observed token share</p></article></section>`;
  const content = loading
    ? `<section id="dashboard-content" class="content"><article class="main-card"><h2 class="card-title">Official usage <span class="tag">Authoritative</span></h2><p class="loading-state">Loading the latest subscription quota…</p></article><article class="main-card"><h2 class="card-title">Model mix <span class="tag">Local token share</span></h2><p class="loading-state">Reading local model usage…</p></article><article class="main-card"><h2 class="card-title">Per-task usage <span class="tag">Local sessions</span></h2><p class="loading-state">Reading local task usage…</p></article></section>`
    : `<section id="dashboard-content" class="content"><article class="main-card"><h2 class="card-title">${usageTitle} <span class="tag">${subscriptionQuota ? "Codex plan" : "Authoritative"}</span></h2>${official}</article><article class="main-card"><h2 class="card-title">Model mix <span class="tag">Local token share</span></h2>${modelMix}<div class="insight"><span class="note-label">Concentration note</span>${insight}</div></article><article class="main-card"><h2 class="card-title">Per-task usage <span class="tag">Local sessions</span></h2>${taskTable(view)}</article></section>`;
  const debugSnapshot = JSON.stringify({ billingSource: subscriptionQuota ? "ChatGPT subscription quota" : creditUsage ? "Codex Credit" : "unavailable", officialUsage: view.officialCredit, observationWindow: view.observationWindow, localUsage: view.localUsageSummary, localTaskCount: (view.localTaskUsage ?? []).length, setupStatus: loading ? null : view.setupStatus ?? readSetupStatus(), diagnostics }, null, 2);
  const diagnosticMessages = diagnostics.map((diagnostic) => `<p><b>${escapeHtml(diagnostic.source === "official" ? "Official usage" : "Model mix")}:</b> ${escapeHtml(diagnostic.message)} ${escapeHtml(diagnostic.remediation)}</p>`).join("");
  const readiness = `<section id="dashboard-readiness" class="readiness${diagnostics.length === 0 ? " is-empty" : ""}" aria-live="polite">${diagnostics.length === 0 ? "" : `<strong>Setup needed</strong>${diagnosticMessages}`}</section>`;
  const debugPanel = `<section id="dashboard-debug" class="readiness debug-log-panel" data-loading="${loading ? "true" : "false"}" aria-live="polite"><div class="debug-log-header"><strong>Debug log</strong><button id="copy-debug" class="action debug-copy" type="button">Copy debug</button></div><pre id="debug-log" class="debug-log" tabindex="0">${escapeHtml(logEntries.join("\n"))}</pre><details class="debug"><summary>Snapshot JSON</summary><textarea id="debug-snapshot" readonly aria-label="Debug snapshot">${escapeHtml(debugSnapshot)}</textarea></details></section>`;
  const quality = loading
    ? `<footer id="dashboard-quality" class="quality">Loading current local usage…</footer>`
    : `<footer id="dashboard-quality" class="quality"><strong>Attribution quality:</strong> ${escapeHtml(view.attributionQuality.message)}</footer>`;
  const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Codex Usage Notes</title><style nonce="${nonce}">
:root{--paper:#f8f5ec;--ink:#1f2328;--muted:#716b61;--grid:rgba(31,35,40,.06);--orange:#d76838;--yellow:#e8c547;--green:#3f8f52;--blue:#3867d6;--teal:#20898d;--pink:#d35f84;--panel:rgba(255,252,243,.92)}*{box-sizing:border-box}body{margin:0;min-width:320px;color:var(--ink);background:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px),var(--paper);background-size:34px 34px;font:15px/1.35 "Avenir Next","PingFang SC",sans-serif}.shell{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:24px 0}.topbar{display:flex;align-items:center;justify-content:space-between;gap:24px}.eyebrow{margin:0;color:var(--orange);font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.topbar h1{margin:2px 0 0;font:800 clamp(28px,3vw,38px)/1 "Chalkboard SE","Marker Felt","Comic Sans MS",sans-serif;letter-spacing:.01em}.topbar h1 span{color:var(--teal)}.subline{margin:5px 0 0;color:var(--muted);font-size:13px}.actions{display:flex;gap:12px}.action{border:2px solid var(--ink);border-radius:12px 15px 11px 14px;padding:8px 12px;color:var(--ink);background:var(--panel);box-shadow:3px 4px 0 rgba(31,35,40,.14);font:800 13px "Avenir Next","PingFang SC",sans-serif;cursor:pointer}.action:hover{transform:translate(-1px,-1px);box-shadow:5px 6px 0 rgba(31,35,40,.14)}.action.primary{border-color:var(--teal);background:#d2f0ef;color:#176c70}.summary{display:grid;grid-template-columns:1.35fr .9fr .9fr;gap:14px;margin-top:18px}.note-card,.main-card,.readiness{border:2px solid var(--ink);border-radius:17px 14px 19px 15px;background:var(--panel);box-shadow:5px 6px 0 rgba(31,35,40,.12)}.note-card{min-height:86px;padding:13px 15px}.note-card:nth-child(2){border-color:var(--teal);background:#d2f0ef}.note-card:nth-child(3){border-color:var(--orange);background:#ffe0c6}.note-label{display:block;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.note-card strong{display:block;margin-top:4px;font-size:20px}.note-card p{margin:4px 0 0;color:#4e4942;font-size:12px}.content{display:grid;grid-template-columns:minmax(340px,1.35fr) minmax(500px,1.8fr);gap:18px;margin-top:18px}.main-card{padding:17px}.card-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;font:800 19px "Chalkboard SE","Marker Felt","Comic Sans MS",sans-serif}.tag{border:1.5px solid var(--teal);border-radius:8px 10px 7px 9px;padding:3px 7px;color:#176c70;background:#d2f0ef;font:800 10px "Avenir Next",sans-serif;letter-spacing:.06em;text-transform:uppercase}.hero-value{font:900 clamp(24px,2.2vw,38px)/1 "Avenir Next",sans-serif;letter-spacing:-.06em;white-space:nowrap}.hero-value small{color:var(--teal);font-size:.3em;letter-spacing:0}.main-card p{margin:5px 0 14px;color:var(--muted);font-size:13px}.progress-label{display:flex;justify-content:space-between;margin:8px 0 4px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.progress-cue{display:flex;align-items:center;gap:9px;margin:5px 0 12px}.progress{width:96px;flex:0 0 96px;height:7px;overflow:hidden;border:0;border-radius:999px;background:#d8d5cc;padding:0}.progress-note{color:var(--muted);font-size:12px;font-weight:700;white-space:nowrap}.progress span{display:block;width:100%;height:100%;border-radius:999px;transform-origin:left;background:var(--ink)}.split{display:flex;gap:28px;margin:8px 0 4px;color:var(--muted);font-size:12px}.split b{display:block;color:var(--ink);font-size:14px}.reset-label{margin-top:10px}.reset-progress span{background:var(--orange)}.board{display:grid;grid-template-columns:185px minmax(0,1fr);align-items:center;gap:14px;min-height:286px}.chart{position:relative;width:185px;height:185px;margin:auto}.chart svg{width:100%;height:100%;overflow:visible}.donut-track,.donut-arc{fill:none;stroke-width:24}.donut-track{stroke:#e4ddd0}.donut-arc{cursor:pointer;transition:opacity .15s,stroke-width .15s}.donut-arc:focus{outline:none;stroke-width:30}.board.has-active .donut-arc:not(.is-active),.board.has-active .model-row:not(.is-active){opacity:.22}.donut-arc.is-active{stroke-width:31}.donut-center{position:absolute;inset:55px 32px;display:flex;flex-direction:column;justify-content:center;text-align:center}.donut-center span{color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase}.donut-center strong{margin:4px 0;font-size:14px;overflow-wrap:anywhere}.donut-center em{color:var(--teal);font-size:20px;font-style:normal;font-weight:900}.model-list{max-height:274px;overflow:auto;padding-right:4px}.model-row{display:grid;grid-template-columns:12px minmax(110px,1fr) 44px 150px;align-items:center;gap:8px;border-bottom:1px dashed rgba(31,35,40,.24);border-radius:8px;padding:9px 5px;transition:opacity .15s,background .15s,transform .15s;cursor:pointer}.model-row:focus{outline:2px solid var(--blue);outline-offset:2px}.model-row.is-active{background:#fff1a8;transform:translateX(3px)}.model-swatch{width:10px;height:10px;border:1px solid var(--ink);border-radius:50% 42% 48% 45%;transform:rotate(-8deg)}.model-name{overflow:hidden;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.model-share{color:var(--muted);text-align:right;font-size:12px}.model-row strong{text-align:right;font-size:12px;letter-spacing:-.04em;white-space:nowrap}.model-row small{color:var(--muted);font-size:9px}.insight{border:2px dashed var(--orange);border-radius:13px 16px 12px 15px;margin-top:12px;padding:10px 12px;background:#fff1a8;font-size:13px}.readiness{margin-top:18px;padding:12px 15px;border-color:var(--orange);background:#fff1a8}.readiness p{margin:5px 0 0;font-size:13px}.quality{margin-top:14px;border-top:1px dashed rgba(31,35,40,.28);padding-top:10px;color:var(--muted);font-size:11px}.empty-state{color:var(--muted)}.loading-state{display:flex;align-items:center;gap:8px;min-height:150px;color:var(--muted);font-weight:700}.loading-state::before{width:12px;height:12px;border:2px solid var(--teal);border-top-color:transparent;border-radius:50%;content:"";animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:800px){.topbar{align-items:flex-start;flex-direction:column}.actions{width:100%}.action{flex:1}.summary,.content{grid-template-columns:1fr}.board{grid-template-columns:1fr}.model-list{max-height:none}.shell{padding:16px 0}}@media(max-width:460px){.actions{gap:8px}.action{padding:8px;font-size:12px}.summary{gap:10px}.model-row{grid-template-columns:12px minmax(0,1fr) 40px 110px}.model-row strong{font-size:10px}}${dynamicStyles}
  </style></head><body><main class="shell"><header class="topbar"><div><p class="eyebrow">Local-only · manual snapshot</p><h1>Usage <span>Field Notes</span></h1><p class="subline">Current official quota and a local model-token share.</p></div><div class="actions"><button id="export-json" class="action" type="button">Export JSON</button><button id="refresh" class="action primary" type="button">Refresh</button></div></header>${summary}${setupStatusBlock(view)}${readiness}${content}${quality}${debugPanel}</main><script nonce="${nonce}">window.bindModelMix=()=>{const board=document.querySelector(".board");const members=[...document.querySelectorAll("[data-model]")];const model=document.getElementById("donut-model");const share=document.getElementById("donut-share");const initialModel=model?.textContent??"—";const initialShare=share?.textContent??"—";const clear=()=>{board?.classList.remove("has-active");for(const item of members)item.classList.remove("is-active");if(model)model.textContent=initialModel;if(share)share.textContent=initialShare};const select=(name)=>{board?.classList.add("has-active");for(const item of members)item.classList.toggle("is-active",item.dataset.model===name);const selected=members.find(item=>item.dataset.model===name);if(model)model.textContent=name??"—";if(share)share.textContent=selected?.dataset.share??"—"};for(const item of members){item.addEventListener("pointerenter",()=>select(item.dataset.model));item.addEventListener("pointerleave",clear);item.addEventListener("focus",()=>select(item.dataset.model));item.addEventListener("blur",clear)}};window.bindModelMix();const debugPanel=document.getElementById("dashboard-debug");const debugLog=document.getElementById("debug-log");if(debugPanel?.dataset.loading==="true"&&debugLog){const startedAt=Date.now();const initialLog=debugLog.textContent??"";window.debugLogTimer=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-startedAt)/1000);debugLog.textContent=initialLog+"\n[loading] Still waiting ("+elapsed+"s)…"},1000)};const exportButton=document.getElementById("export-json");exportButton.addEventListener("click",async()=>{exportButton.disabled=true;exportButton.textContent="Preparing…";try{const response=await fetch("/api/usage");if(!response.ok)throw new Error("Unable to export usage");const usage=await response.json();const exportedAt=new Date().toISOString();const blob=new Blob([JSON.stringify({exportedAt,...usage},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="codex-usage-"+exportedAt.replace(/[.:]/g,"-")+".json";link.click();URL.revokeObjectURL(url)}finally{exportButton.disabled=false;exportButton.textContent="Export JSON"}});const copyDebug=document.getElementById("copy-debug");copyDebug?.addEventListener("click",async()=>{const log=document.getElementById("debug-log");const snapshot=document.getElementById("debug-snapshot");if(!(snapshot instanceof HTMLTextAreaElement))return;const payload=(log?.textContent?log.textContent+"\n\n":"")+"Snapshot:\n"+snapshot.value;if(navigator.clipboard)await navigator.clipboard.writeText(payload);else{const bridge=document.createElement("textarea");bridge.value=payload;document.body.append(bridge);bridge.select();document.execCommand("copy");bridge.remove()}copyDebug.textContent="Copied";setTimeout(()=>{copyDebug.textContent="Copy debug"},1500)});document.getElementById("refresh").addEventListener("click",()=>location.reload());</script></body></html>`;
  return document;
}

function loadingView(): UsageViewModel {
  return {
    observationWindow: { since: "Loading", until: "", timezone: "UTC" },
    officialCredit: { status: "unavailable" },
    estimatedCreditAttribution: [],
    localUsageSummary: { modelCount: 0, tokenCount: 0 },
    attributionQuality: { status: "unavailable", message: "Loading current local usage." }
    , diagnostics: []
  };
}

function failedView(message: string): UsageViewModel {
  return {
    ...loadingView(),
    attributionQuality: { status: "unavailable", message: `Dashboard refresh failed: ${message}` }
  };
}

function replacementDocument(view: UsageViewModel, nonce: string, debugLines: string[]): string {
  const page = JSON.stringify(html(view, nonce, false, debugLines)).replace(/</g, "\\u003c");
  const serializedNonce = JSON.stringify(nonce);
  return `<script nonce="${nonce}">const nextDocument=new DOMParser().parseFromString(${page},"text/html");for(const id of ["dashboard-summary","dashboard-setup","dashboard-readiness","dashboard-content","dashboard-quality"]){const current=document.getElementById(id);const replacement=nextDocument.getElementById(id);if(current&&replacement)current.replaceWith(replacement)}const nextDebug=nextDocument.getElementById("dashboard-debug");const debugPanel=document.getElementById("dashboard-debug");const debugLog=document.getElementById("debug-log");const debugSnapshot=document.getElementById("debug-snapshot");if(nextDebug&&debugPanel){debugPanel.dataset.loading="false";const nextLog=nextDebug.querySelector("#debug-log");const nextSnapshot=nextDebug.querySelector("#debug-snapshot");if(debugLog&&nextLog)debugLog.textContent=nextLog.textContent;if(debugSnapshot instanceof HTMLTextAreaElement&&nextSnapshot instanceof HTMLTextAreaElement)debugSnapshot.value=nextSnapshot.value}const styles=nextDocument.querySelector("style")?.textContent;if(styles){const style=document.createElement("style");style.nonce=${serializedNonce};style.textContent=styles;document.head.append(style)}window.bindModelMix?.();if(window.debugLogTimer)clearInterval(window.debugLogTimer);</script>`;
}

function authority(server: Server): string | undefined {
  const address = server.address();
  return address && typeof address !== "string" ? `127.0.0.1:${address.port}` : undefined;
}

function isCurrentLoopbackHost(request: IncomingMessage, server: Server): boolean {
  return request.headers.host?.toLowerCase() === authority(server)?.toLowerCase();
}

function isCurrentLoopbackOrigin(request: IncomingMessage, server: Server): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  return origin.toLowerCase() === `http://${authority(server)}`.toLowerCase();
}

function hasBody(request: IncomingMessage): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean): void => { if (!settled) { settled = true; resolve(result); } };
    request.once("end", () => finish(false));
    request.once("error", () => finish(true));
    request.on("data", (chunk: Buffer) => { if (chunk.length > 0) finish(true); });
  });
}

export function createDashboardServer(provider: SnapshotProvider): Server {
  let server: Server;
  server = createServer(async (request, response) => {
    const nonce = randomBytes(16).toString("base64");
    setSecurityHeaders(response, nonce);
    if (!isCurrentLoopbackHost(request, server) || !isCurrentLoopbackOrigin(request, server)) {
      response.statusCode = 403;
      response.end();
      return;
    }
    const method = request.method ?? "GET";
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if ((path === "/" && method !== "GET") || (path === "/api/usage" && method !== "GET") || (path === "/api/refresh" && method !== "POST")) {
      response.statusCode = 405;
      response.setHeader("allow", path === "/api/refresh" ? "POST" : "GET");
      response.end();
      return;
    }
    if (path !== "/" && path !== "/api/usage" && path !== "/api/refresh") {
      response.statusCode = 404;
      response.end();
      return;
    }
    if (path === "/api/refresh" && await hasBody(request)) {
      response.statusCode = 400;
      response.end();
      return;
    }
    if (path === "/") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.flushHeaders();
      response.write(html(loadingView(), nonce, true));
      const startedAt = Date.now();
      try {
        const view = await provider.refresh();
        response.end(replacementDocument(view, nonce, snapshotDebugLog(view, Date.now() - startedAt)));
      } catch (error) {
        const message = errorMessage(error);
        const view = failedView(message);
        response.end(replacementDocument(view, nonce, snapshotDebugLog(view, Date.now() - startedAt, message)));
      }
      return;
    }
    try {
      const view = await provider.refresh();
      if (path === "/api/usage" || path === "/api/refresh") {
        writeJson(response, 200, view);
      }
    } catch {
      writeJson(response, 500, { error: "Unexpected dashboard failure." });
    }
  });
  return server;
}
