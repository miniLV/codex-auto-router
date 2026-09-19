import assert from "node:assert/strict";
import test from "node:test";
import { CapabilityDiscovery } from "../src/discovery.js";
import { catalog, host, now } from "./routing-fixtures.js";

test("discovery requires current requestability and enforced recipes; cache cannot outlive evidence", () => {
  const discovery = new CapabilityDiscovery();
  const snapshot = { ...catalog(), evidence_mode: "simulation" as const };
  snapshot.entries.find(e => e.kind === "model")!.evidence.source = "tool_listing";
  const first = discovery.discover(host, now, snapshot);
  assert.equal(first.entries.some(e => e.kind === "model"), false);
  assert.equal(discovery.discover(host, now, snapshot).digest, first.digest);
  assert.equal(discovery.discover(host, 1000, snapshot).entries.length, 0);
  assert.equal(discovery.discover({ ...host, session_id: "new" }, now, snapshot).templates.length, 0);
});
