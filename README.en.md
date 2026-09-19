# Jev Auto Router

**Jev chooses the route. Policy Guard only ALLOW / DENY. Codex executes. Root verifies and accepts.**

A Codex plugin for recoverable, auditable delegation: Root keeps judgment; Jev is the automatic routing brain; anything unsafe or unqualified falls back to Root.

[简体中文](README.md) · [Policy](skills/jev-auto-router/references/routing-policy.md) · [Architecture](docs/solution.md)

---

## Why

Flagship Codex sessions burn quota on mechanical work. This plugin routes **bounded, verifiable** implementation units through a gate:

1. **Task Capsule** — five concrete sections + three mechanical checks (paths, pre-run verification, baseline)
2. **Jev** — one typed Choice for the route plan (when prerequisites hold)
3. **Policy Guard** — only `ALLOW(RoutePlan)` or `DENY → Root` (no silent rewrite)
4. **Execute + verify** — Codex-native spawn; Root mechanical verification; restore baseline on failure

---

## Quick start

Needs current Codex CLI with plugins, Root = `gpt-6-astra` or `gpt-5.6-sol` at Medium+, and `spawn_agent`.

```sh
codex plugin marketplace add miniLV/Jev-Auto-Router --ref master
codex plugin add jev-auto-router@jev-auto-router
```

Then in a task:

```text
Use $jev-auto-router:jev-auto-router to implement <feature> and verify it.
```

### Honest status (read this)

Architecture preview. Runtime modules exist and are tested, but **real host evidence + benchmark qualification are still UNVERIFIED**, so automatic delegation is **off by default** (`DENY(PROFILE_UNQUALIFIED)`). Today the plugin still gives you the Policy path: Root executes under the contract. No blanket “saves quota” claim until qualification lands.

---

## How it works

```text
Task Capsule → Capability Catalog → Jev → RoutePlan
  → Policy Guard (ALLOW | DENY→Root)
  → Codex execution (record requested vs observed)
  → Root verify → (risk) semantic review → accept / restore
```

- Jev is the only automatic selector; timeout / bad output / low confidence → Root
- Guard has veto, not rewrite
- One active child; hard budgets; Decision Receipts
- Dashboard / `ccusage` are **observers only** — never feed routing

Details: [routing-policy.md](skills/jev-auto-router/references/routing-policy.md) (canonical).

---

## Optional

```sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
npm run setup && npm run dashboard   # local observer UI (Node 22+)
npm test && npm run typecheck
```

---

## License

[Apache License 2.0](LICENSE)
