import assert from "node:assert/strict";
import test from "node:test";
import { prepareProbe, invokeProbe, type ProbeCommand } from "../src/exec.js";
import { guardFixture } from "./policy-guard.test.js";

test("P3 rejects writable configurations and forged probe commands", async () => {
  const f = guardFixture();
  assert.deepEqual(prepareProbe(f.plan, f.context, "execution", "state"), { denied: "PROBE_NOT_READ_ONLY" });
  const fabricated = { execution_mode: "probe_read_only" } as ProbeCommand;
  await assert.rejects(invokeProbe(fabricated, { evidence_mode: "simulation", invoke: async () => { throw new Error("must not invoke"); } },
    new AbortController().signal), /DISPATCH_DISARMED/);
  // @ts-expect-error P3 cannot construct a delegated-write command.
  const write: ProbeCommand = { execution_mode: "delegated_write" };
  assert.equal(write.execution_mode, "delegated_write");
});
