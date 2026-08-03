# Native Subagent Lifecycle

This file is the native-invocation Seam. It executes a decision from the
[Runtime Router Policy](routing-policy.md); it never chooses a route, model,
effort, or fallback.

The lifecycle has one ownership invariant: every writable path is either still
owned by Root, exclusively owned by the active child, explicitly adopted by
Root, or restored to its captured baseline. No unresolved writable path may
remain at a transition.

## 1. Prepare (Root owns)

1. Read the canonical Policy and confirm the all-required gate.
2. Confirm that the native child tool exposes model, reasoning-effort, and
   fresh-context controls, and accepts the selected fixed tuple.
3. Confirm repository safety: no active merge/rebase conflict and no ambiguous
   ownership, scope, baseline, or restore state.
4. Build one self-contained Task Packet with exact, mutually exclusive owned
   paths and a captured preflight baseline for every writable path.
5. Record break-even in one unit and confirm strict positive break-even.

If any fact is uncertain, do not create a child; remain `ROOT_DIRECT`.

## 2. Create (Root creates, child owns)

1. Create exactly one native child with the complete Task Packet and the exact
   tuple selected by the Policy.
2. Give it fresh context. Do not use an App Thread, inherited full-history
   context, a different model, or an implicit fallback.
3. Record the returned child identifier, but do not treat creation as proof of
   correctness.
4. Transfer exclusive ownership only for the packet's declared writable
   paths. Root must not edit those paths while the child is active.

The child may not create descendants, choose a route, change its tuple, or
expand its owned paths.

## 3. Collect and verify (Root owns verification)

1. Wait only when Root needs the result.
2. Inspect the child's final response and every declared workspace output.
3. Compare changed paths with the packet and its captured baseline.
4. Run the packet's deterministic verification from Root.
5. Adopt only verified output; record exact evidence and transfer ownership to
   Root. Restore non-adopted output before closing the child.

On successful Luna, Luna ends before Root adopts verified output. On successful
Terra, Root follows the same verification and adoption boundary.

## 4. Focused repair (Terra only)

If Terra's response is promising but lacks a specific material detail, Root may
send a focused repair follow-up to the same child, retaining the same model,
effort, execution surface, and fresh-context boundary. In the same session,
the initial attempt plus at most two focused repair follow-ups are allowed.

Do not resend the full packet, create a replacement, switch models, switch
effort, switch surface, or broaden ownership. After the second repair or any
definite failure, proceed to resolution.

## 5. Luna failure and the one Terra option (Root owns resolution)

On Luna failure or unverifiable output, Luna ends. Root must enumerate the
complete diff against the captured baseline, independently verify candidates,
adopt only verified candidates, restore every non-adopted owned path, and
record the resolved post-Luna baseline.

Only after every Luna-owned path has an explicit adopted or restored state may
Root create exactly one fresh Terra child for a remaining bounded remnant. Its
packet must name the resolved baseline, all adoption/restoration evidence,
every remnant, and that no unverified Luna changes are present. There is no
second Luna and no other fallback child.

## 6. Close (Root owns)

Before Root takes over or delivers, the child identifier/state must be known
and every owned writable path must be explicitly adopted or restored. If child
identity or state is uncertain, treat it as a failed/uncertain result: do not
claim completion, resolve paths against the baseline, and continue Direct.

Root resolves conflicts, integrates only verified output, runs final checks,
and delivers. This static lifecycle documents the contract; it is not runtime
proof that a platform obeyed it.
