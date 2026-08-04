# Shared Context

This glossary describes the automatic-routing contract. The
[Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md)
is the sole canonical deep runtime Module; this file is explanatory context
and cannot define a route.

| Term | Definition |
| --- | --- |
| Main Task | The user-visible task in which the request is received and the final result is delivered. |
| Root Agent | The owner of intent, planning, judgment decisions, the dispatch specification, external actions, verification, and delivery. |
| Root Model | The model selected for the Main Task. Automatic routing never changes it. |
| Root Condition | Background routing requires trusted current-task evidence for `gpt-5.6-sol` at `medium`, `high`, `xhigh`, `max`, or `ultra`. Any other or unverified tuple stays `ROOT_DIRECT`. |
| Auto Router | The shallow Adapter that automatically considers every Main Task and delegates only when the canonical Policy gate passes. |
| Runtime Router Policy | The sole canonical deep runtime Module for eligibility, the dispatch template, fixed child tuples, verification, review triggering, and failure behavior. |
| Adapter | A shallow integration layer such as Skill metadata. An Adapter points to the Module and cannot duplicate its state machine or route table. |
| Route Decision | Exactly `ROOT_DIRECT`, Luna, or Terra, as returned by the Policy gate. |
| Dispatch template | The five-section specification (OBJECTIVE, FILES AND OWNERSHIP, INTERFACES, CONSTRAINTS, VERIFICATION) plus its structured RETURN fields. Delegation is permitted only when every section passes the Policy's three mechanical checks. |
| Luna shapes | The two dispatch shapes eligible for the Luna tuple: bounded read-only evidence, or a single-file (or same-directory, same-kind) write with no public-interface change and one binary verification command. Everything else eligible goes to Terra. |
| Baseline | The captured state of every writable path before dispatch. Restore from the baseline is the primary recovery from a failed or rejected result. |
| Mechanical verification | Root's own adoption gate: read the complete diff, confirm scope, and rerun the verification commands the child's owned paths could affect. It is never satisfied by the child's self-report. |
| Semantic review | The single risk-triggered `gpt-5.6-sol` / `medium` fresh-context review of a persistent change. It judges both the diff and whether the specification itself was adequate, and returns exactly `ACCEPT`, `REVISE`, or `RECONSIDER`. |
| Dispatch budget | At most two dispatches per Main Task: the original child and one corrected retry from the restored baseline. Failed, timed-out, unverifiable, and rejected dispatches all count. |
| Depth | One active delegated child at a time. Reviewer and worker never run concurrently, and no child may delegate. |
| Residual risk | A condition the host cannot make observable, such as an unlabeled child tuple or an unenforced reviewer sandbox. It is recorded and reported — never silently assumed safe, and never a reason by itself to discard independently verified output. |
| Dashboard | Dashboard, `ccusage`, `src/credit.ts`, and any Credit or usage estimate are independent observers or product implementation, never routing input or control. |
| Static contract | Documentation, metadata, and static tests that validate shapes and boundaries. They do not prove runtime enforcement. |
| Runtime proof | Evidence from a real platform invocation and Root verification; it is separate from static contract checks. |
| Competing routing authority | Any other routing or orchestration policy governing the current task. The Auto Router stands down to `ROOT_DIRECT` instead of competing with it. |

The contract deliberately has no executable router engine, classifier, registry,
LLM router, routing dependency, telemetry, or Dashboard control artifact.
