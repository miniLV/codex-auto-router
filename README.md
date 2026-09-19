# Jev Auto Router

**Jev 负责选路；Policy Guard 只有 ALLOW / DENY；Codex 执行；Root 验证与验收。**

面向 Codex 的可恢复、可审计委派插件：Root 保留判断；Jev 是自动选路大脑；不安全或未达标时一律回 Root。

[English](README.en.md) · [Policy](skills/jev-auto-router/references/routing-policy.md) · [架构](docs/solution.md)

---

## 为什么做

旗舰会话容易把配额花在机械执行上。本插件把**有界、可验证**的实现单元过一道门：

1. **Task Capsule** — 五段具体规格 + 三条机械检查（路径、预跑验证、baseline）
2. **Jev** — 一次 typed Choice 出 RoutePlan（前置条件满足时）
3. **Policy Guard** — 只有 `ALLOW(RoutePlan)` 或 `DENY → Root`（不静默改道）
4. **执行 + 验收** — Codex 原生 spawn；Root 机械验证；失败先恢复 baseline

---

## 快速开始

需要：支持插件的当前 Codex CLI；Root 为 `gpt-6-astra` 或 `gpt-5.6-sol` 且 Medium+；以及 `spawn_agent`。

```sh
codex plugin marketplace add miniLV/codex-auto-router --ref master
codex plugin add jev-auto-router@jev-auto-router
```

任务里：

```text
Use $jev-auto-router:jev-auto-router to implement <feature> and verify it.
```

### 诚实现状（请先读）

架构预览。运行时 Modules 已落地并有测试，但**真实 host 证据与 benchmark 资格仍未验证**，因此**自动委派默认关闭**（`DENY(PROFILE_UNQUALIFIED)`）。今天装上仍可按 Policy 走 Root 路径。在资格冻结前，不宣称「已普遍省配额」。

---

## 怎么工作

```text
Task Capsule → Capability Catalog → Jev → RoutePlan
  → Policy Guard（ALLOW | DENY→Root）
  → Codex 执行（记录 requested vs observed）
  → Root 验证 →（风险）语义 review → 验收 / 恢复
```

- 自动选路只有 Jev；超时 / 坏输出 / 低置信 → Root
- Guard 只有否决权，没有改道权
- 同时一个 child；硬预算；Decision Receipt
- Dashboard / `ccusage` **只观察**，永不回流进路由

权威规则：[routing-policy.md](skills/jev-auto-router/references/routing-policy.md)

---

## 可选

```sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
npm run setup && npm run dashboard   # 本地观察面板（Node 22+）
npm test && npm run typecheck
```

---

## License

[Apache License 2.0](LICENSE)
