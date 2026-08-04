# Install a pinned Fresh Reviewer profile

Status: Superseded by the current Runtime Router Policy.

Fresh Review uses one installed custom-agent profile that pins the reviewer
name, Sol / Medium, and requested read-only sandbox mode. Root remains eligible
only when trusted current-task evidence shows Sol at Medium reasoning or higher;
the automatic lifecycle never upgrades reviewer effort. A non-mutating exactness
check verifies only installed-profile equality; it does not prove a fresh
context.

`fork_turns: none` is runtime spawn evidence for deferred P7, together with no
Main Task history. Exact-rollout runtime evidence must completely show model,
effort, sandbox, permission, and cwd. The local inspector may inspect only that
rollout UUID and is intentionally stricter than upstream: it cannot fill,
infer, or normalize omitted evidence, and missing sandbox is never called
read-only. Missing, incomplete, or ambiguous P7 evidence makes Fresh Review
unavailable; Root restores any unreviewed Persistent-change Candidate to its
resolved pre-candidate baseline and takes over under the original authorization.
The static contract defines this fail-close behavior but does not claim P7 executed or
passed.
