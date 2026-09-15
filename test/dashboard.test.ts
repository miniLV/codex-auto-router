import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDashboardServer } from "../src/server.js";
import type { SetupStatus } from "../src/setup.js";
import type { SnapshotProvider, UsageViewModel } from "../src/types.js";

let calls = 0;
const readySetupStatus: SetupStatus = {
  ready: true,
  node: { ready: true, version: "v22.23.2", message: "Node.js is ready.", remediation: "" },
  codex: { ready: true, version: "codex-cli 0.146.0", message: "Codex CLI is ready.", remediation: "" },
  ccusage: { ready: true, version: "ccusage 20.0.19", message: "ccusage is ready.", remediation: "" }
};
const available: UsageViewModel = {
  observationWindow: { since: "2026-07-16", until: "2026-07-30", timezone: "UTC" },
  officialCredit: { status: "available", kind: "credit", source: "individualLimit", limit: "500.00", used: "12.34", remaining: "487.66", remainingPercent: 97, resetsAt: "2026-08-01T00:00:00.000Z" },
  estimatedCreditAttribution: [
    { model: "gpt-5.6-terra", credits: "1.23", share: 0.1 },
    { model: "gpt-6-astra", credits: "11.11", share: 0.9 }
  ],
  localTaskUsage: [
    { lastActivity: "2026-08-28T15:07:26.950Z", models: [{ model: "gpt-6-astra", tokens: 158656 }, { model: "gpt-5.6-terra", tokens: 4120 }], tokens: 162776 },
    { lastActivity: "2026-08-27T09:30:00.000Z", models: [{ model: "gpt-5.6-terra", tokens: 2100 }], tokens: 2100 }
  ],
  localUsageSummary: { modelCount: 2, tokenCount: 3 },
  attributionQuality: { status: "estimated", message: "Estimated from local model-token shares; official credit remains authoritative." },
  diagnostics: [],
  setupStatus: readySetupStatus
};
const subscriptionAvailable: UsageViewModel = {
  observationWindow: { since: "2026-08-01", until: "2026-08-03", timezone: "UTC" },
  officialCredit: { status: "available", kind: "subscription-quota", source: "primary", usedPercent: 45, remainingPercent: 55, windowDurationMins: 10_080, resetsAt: "2026-08-10T00:00:00.000Z", planType: "plus" },
  estimatedCreditAttribution: [],
  localModelShare: [{ model: "gpt-5.6-terra", share: 0.25 }, { model: "gpt-6-astra", share: 0.75 }],
  localUsageSummary: { modelCount: 2, tokenCount: 100 },
  attributionQuality: { status: "unavailable", message: "The official subscription quota exposes usage percentage only; local model shares are available but cannot be converted to credit amounts." },
  diagnostics: [],
  setupStatus: readySetupStatus
};
const provider: SnapshotProvider = { refresh: async () => { calls += 1; return available; } };
const server = createDashboardServer(provider);

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function callServer(target: Server, method: string, path: string, body?: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  const port = (target.address() as AddressInfo).port;
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers: body ? { "content-type": "text/plain" } : undefined }, (res) => {
      let response = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { response += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: response }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

function call(method: string, path: string, body?: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return callServer(server, method, path, body);
}

test("GET / renders one fresh snapshot with the three primary blocks", async () => {
  calls = 0;
  const response = await call("GET", "/");
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.match(response.body, /Loading the latest subscription quota/);
  assert.match(response.body, /dashboard-summary/);
  assert.match(response.body, /DOMParser/);
  assert.doesNotMatch(response.body, /document\.open/);
  const body = response.body.replace(/\\u003c/g, "<").replace(/\\"/g, '"');
  assert.match(body, /Official Credit/);
  assert.match(body, /Model mix/);
  assert.match(body, /Attribution quality:/);
  assert.match(body, /model-donut/);
  assert.match(body, /id="donut-model">gpt-6-astra/);
  assert.match(body, /90\.0%/);
  assert.match(body, /Per-task usage/);
  assert.match(body, /2026-08-28 15:07 UTC/);
  assert.match(body, /2026-08-27 09:30 UTC/);
  assert.match(body, /<b>gpt-6-astra<\/b> 158,656/);
  assert.match(body, /162,776/);
  assert.match(body, /prompts excluded/);
  assert.match(body, /data-model=/);
  assert.match(body, /pointerenter/);
  assert.match(body, /Credit used/);
  assert.match(body, /Time to reset/);
  assert.match(body, /97\.0% remaining/);
  assert.match(body, /transform:scaleX\(0\.03\)/);
  assert.match(body, /\.usage-progress span\{transform:scaleX\(0\.03\)\}/);
  assert.doesNotMatch(body, /style="transform:/);
  assert.match(body, /Attribution period/);
  assert.match(body, /Billing source/);
  assert.match(body, /Credit/);
  assert.match(body, /API token usage is separate/);
  assert.match(body, /Official Credit/);
  assert.match(body, /2026-07-16 – 2026-07-30 UTC/);
  assert.match(body, /id="export-json"/);
  assert.match(body, /fetch\("\/api\/usage"/);
  assert.match(body, /codex-usage-/);
  assert.match(body, /<button id="refresh" class="action primary" type="button">Refresh<\/button>/);
  assert.match(body, /dashboard-setup/);
  assert.match(body, /setup-status is-ready/);
  assert.match(body, /🟢 Setup ready/);
  assert.match(body, /v22\.23\.2/);
  assert.match(body, /codex-cli 0\.146\.0/);
  assert.match(body, /ccusage 20\.0\.19/);
  assert.match(body, /dashboard-readiness/);
  assert.match(body, /\.readiness\.is-empty\{display:none\}/);
  assert.match(body, /dashboard-debug/);
  assert.match(body, /Debug log/);
  assert.match(body, /Still waiting/);
  assert.match(body, /Debug snapshot/);
  assert.match(body, /Copy debug/);
  assert.match(body, /localUsage/);
  assert.match(body, /navigator\.clipboard\.writeText/);
  assert.match(body, /addEventListener\("click",\(\)=>location\.reload\(\)\)/);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  const nonce = /<script nonce="([^"]+)">/.exec(body)?.[1];
  assert.ok(nonce);
  assert.ok(String(response.headers["content-security-policy"]).includes(`nonce-${nonce}`));
  assert.ok(String(response.headers["content-security-policy"]).includes("connect-src 'self'"));
  const nextResponse = await call("GET", "/");
  const nextNonce = /<script nonce="([^"]+)">/.exec(nextResponse.body)?.[1];
  assert.notEqual(nextNonce, nonce);
  assert.ok(String(nextResponse.headers["content-security-policy"]).includes(`nonce-${nextNonce}`));
});

test("GET / renders the current subscription quota instead of invented credits", async () => {
  const subscriptionServer = createDashboardServer({ refresh: async () => subscriptionAvailable });
  await new Promise<void>((resolve) => subscriptionServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await callServer(subscriptionServer, "GET", "/");
    assert.equal(response.status, 200);
    const body = response.body.replace(/\\u003c/g, "<").replace(/\\"/g, '"');
    assert.match(body, /Subscription usage/);
    assert.match(body, /55\.0% <small>remaining/);
    assert.match(body, /Usage · 45\.0%/);
    assert.match(body, /Weekly quota window/);
    assert.match(body, /Local token share/);
    assert.match(body, /of the locally observed model-token share/);
    assert.match(body, /No per-task usage is available/);
    assert.doesNotMatch(body, /CR current-cycle limit/);
    assert.doesNotMatch(body, /CR est\./);
  } finally {
    await new Promise<void>((resolve, reject) => subscriptionServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("GET / highlights only missing setup checks and links their guides", async () => {
  const needsSetup: SetupStatus = {
    ready: false,
    node: readySetupStatus.node,
    codex: { ready: false, version: "", message: "Codex CLI was not found in this shell.", remediation: "Install Codex CLI, then rerun npm run setup.", helpUrl: "https://developers.openai.com/codex/cli/" },
    ccusage: { ready: false, version: "", message: "The project-local ccusage package is missing.", remediation: "Run npm ci, then rerun npm run setup." }
  };
  const issueServer = createDashboardServer({ refresh: async () => ({ ...available, setupStatus: needsSetup }) });
  await new Promise<void>((resolve) => issueServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await callServer(issueServer, "GET", "/");
    assert.equal(response.status, 200);
    const body = response.body.replace(/\\u003c/g, "<").replace(/\\"/g, '"');
    const blocks = [...body.matchAll(/<section id="dashboard-setup"[\s\S]*?<\/section>/g)].map((match) => match[0]);
    const finalBlock = blocks.at(-1) ?? "";
    assert.match(finalBlock, /setup-status has-issues/);
    assert.match(finalBlock, /Codex CLI/);
    assert.match(finalBlock, /https:\/\/developers\.openai\.com\/codex\/cli\//);
    assert.match(finalBlock, /ccusage/);
    assert.match(finalBlock, /Run npm ci/);
    assert.doesNotMatch(finalBlock, /Node\.js/);
    assert.doesNotMatch(finalBlock, /🟢 Ready/);
  } finally {
    await new Promise<void>((resolve, reject) => issueServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("GET / renders a copyable debug log when refresh fails", async () => {
  const errorServer = createDashboardServer({ refresh: async () => { throw new Error("Codex app-server timeout"); } });
  await new Promise<void>((resolve) => errorServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await callServer(errorServer, "GET", "/");
    assert.equal(response.status, 200);
    const body = response.body.replace(/\\u003c/g, "<").replace(/\\"/g, '"');
    assert.match(body, /dashboard-debug/);
    assert.match(body, /Debug log/);
    assert.match(body, /Waiting for snapshot provider/);
    assert.match(body, /Snapshot provider failed/);
    assert.match(body, /Codex app-server timeout/);
    assert.match(body, /id="copy-debug"/);
  } finally {
    await new Promise<void>((resolve, reject) => errorServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("GET /api/usage returns one fresh safe view model", async () => {
  calls = 0;
  const response = await call("GET", "/api/usage");
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(response.body), available);
  assert.doesNotMatch(response.body, /source error|prompt|sessionFile/i);
});

test("POST /api/refresh takes one fresh snapshot only when the body is empty", async () => {
  calls = 0;
  const response = await call("POST", "/api/refresh");
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(response.body), available);
  const rejected = await call("POST", "/api/refresh", "meaningful-body");
  assert.equal(rejected.status, 400);
  assert.equal(calls, 1);
});

test("known read failures are represented as a 200 availability state", async () => {
  const unavailableServer = createDashboardServer({ refresh: async () => ({
    observationWindow: { since: "2026-07-16", until: "2026-07-30", timezone: "UTC" },
    officialCredit: { status: "unavailable" },
    estimatedCreditAttribution: [],
    localUsageSummary: { modelCount: 0, tokenCount: 0 },
    attributionQuality: { status: "unavailable", message: "Official credit is unavailable, so estimates are unavailable." },
    diagnostics: [{ source: "official", code: "read-timeout", message: "Official usage did not respond within 8 seconds.", remediation: "Restart or update Codex, then retry." }]
  }) });
  await new Promise<void>((resolve) => unavailableServer.listen(0, "127.0.0.1", resolve));
  const port = (unavailableServer.address() as AddressInfo).port;
  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/api/usage" }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
  await new Promise<void>((resolve, reject) => unavailableServer.close((error) => error ? reject(error) : resolve()));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).officialCredit.status, "unavailable");
  assert.match(response.body, /Official usage did not respond within 8 seconds/);
});
