import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { descriptionsDigest, QUESTION_TEMPLATE_DIGEST, route, type AdapterContext } from "../src/jev-adapter.js";
import type { RouteRequest, SelectionPolicy } from "../src/route-plan.js";
import { snapshot } from "./routing-fixtures.js";

export function adapterFixture() {
  const projection = { schema_revision: "task-capsule/1", projection_rule_digest: "projection-rule", main_task_id: "main",
    task_unit_id: "unit", capsule_revision: 1, capsule_digest: "capsule", intent_digest: "intent", authorization_revision: 1,
    objective_summary: "Update the fixture.", acceptance_summaries: [{ id: "a", summary: "Fixture passes." }],
    task_traits: { owned_file_count_bucket: "1", changed_language: ["typescript"], side_effect_class: "bounded_write",
      public_interface_touched: false, verification_count: 1, context_size_bucket: "0", persistent_change: true, risk_flags: [] },
    interface_constraints: [], risk_flags: [], side_effect_class: "bounded_write", relevant_context_summary: "Fixture context.",
    context_complete: true, provenance: [{ kind: "root_authored", ref: "summary", content_category: "task_summary", authority: "fact" }],
    egress_policy_digest: "egress" };
  const request: RouteRequest = { decision_id: "decision", main_task_id: "main", task_unit_id: "unit", capsule_revision: 1,
    routing_projection: projection, candidate_snapshot: snapshot(), attempt_snapshot: { decision_count: 1, worker_execution_count: 0 },
    frozen_selection_policy_ref: "policy", qualification_binding_ref: "qualification", evidence_mode: "simulation" };
  const policy: SelectionPolicy = { id: "policy", confidence_floor: 0.7, question_template_digest: QUESTION_TEMPLATE_DIGEST, binding_digest: "binding" };
  const context: AdapterContext = { api_key: "synthetic-key", egress: { origin: "https://api.typesafe.ai", policy_digest: "egress",
    projection_digest: digest(projection), candidate_descriptions_digest: descriptionsDigest(request), expires_at: Date.now() + 100000 },
    sizing: { provider_model: "jev-1.13.0", evidence_digest: "simulation-only", count: () => 100 }, approved_sizing_digests: ["simulation-only"],
    annotations: { risk: { class: "ordinary", source: "capsule_and_policy" },
      benefit_class: { value: "research_unqualified", evidence_ref: "qualification" }, reason_codes: ["JEV_DELEGATE"] },
    decision_open: () => true, reserve_http_attempt: () => true };
  const id = request.candidate_snapshot.candidates[1].candidate_id;
  const response = { model: "jev-1.13.0", answers: { route: { choice: id, probabilities: { root: 0.1, [id]: 0.9 }, confidence: 0.9 } },
    usage: { input_tokens: 12, output_tokens: 2 } };
  return { request, policy, context, response };
}

test("adapter sends one Choice and normalizes the exact chosen contract without local data", async () => {
  const f = adapterFixture();
  let calls = 0;
  f.context.fetch = async (_, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(body.questions), ["route"]);
    assert.equal(body.questions.route.type, "choice");
    assert.equal(body.model, "jev-1.13.0");
    assert.equal(init?.redirect, "error");
    assert.equal(String(init?.body).includes("synthetic-key"), false);
    assert.equal(String(init?.body).includes("write_paths"), false);
    return Response.json(f.response);
  };
  const result = await route(f.request, f.policy, new AbortController().signal, f.context);
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  if (result.ok && result.plan.decision === "delegate") assert.deepEqual(result.plan.execution,
    (f.request.candidate_snapshot.candidates[1] as { execution: unknown }).execution);
});

test("unsafe projection, unproved sizing, overflow and cancellation cause zero HTTP calls", async () => {
  for (const fault of ["egress", "sizing", "overflow", "cancel", "extra"] as const) {
    const f = adapterFixture();
    const controller = new AbortController();
    let calls = 0;
    f.context.fetch = async () => { calls++; throw new Error("must not call"); };
    if (fault === "egress") f.context.egress.origin = "https://unapproved.example";
    if (fault === "sizing") f.context.sizing = undefined;
    if (fault === "overflow") f.context.sizing!.count = () => 32001;
    if (fault === "cancel") controller.abort();
    if (fault === "extra") f.request.routing_projection.raw_log = "secret";
    assert.equal((await route(f.request, f.policy, controller.signal, f.context)).ok, false);
    assert.equal(calls, 0, fault);
  }
});

test("malformed, drift, low confidence and authentication failure are terminal", async () => {
  for (const fault of ["malformed", "drift", "confidence", "auth"] as const) {
    const f = adapterFixture(); let calls = 0;
    if (fault === "drift") f.response.model = "jev-latest";
    if (fault === "confidence") f.response.answers.route.confidence = 0.2;
    f.context.fetch = async () => { calls++; return fault === "auth" ? new Response("private error", { status: 401 }) :
      fault === "malformed" ? new Response("invalid json") : Response.json(f.response); };
    const result = await route(f.request, f.policy, new AbortController().signal, f.context);
    assert.equal(result.ok, false); assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes("private error"), false);
  }
});

test("retry honors Retry-After and missing usage remains UNKNOWN", async () => {
  const f = adapterFixture(); let calls = 0;
  f.context.fetch = async () => { calls++; return calls === 1 ? new Response(null, { status: 429, headers: { "retry-after": "0" } }) : Response.json(f.response); };
  const result = await route(f.request, f.policy, new AbortController().signal, f.context);
  assert.equal(result.ok, true); assert.equal(calls, 2);
  if (result.ok) assert.equal(result.provider_attempts[0].input_tokens, "UNKNOWN");
  calls = 0;
  f.context.fetch = async () => { calls++; return new Response(null, { status: 529, headers: { "retry-after": "60" } }); };
  assert.equal((await route(f.request, f.policy, new AbortController().signal, f.context)).ok, false);
  assert.equal(calls, 1);
});

test("late responses and body reads cannot outlive cancellation into a valid plan", async () => {
  const f = adapterFixture(); const controller = new AbortController();
  f.context.fetch = async () => { controller.abort(); return Response.json(f.response); };
  const result = await route(f.request, f.policy, controller.signal, f.context);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.kind, "CANCELLED");
});
