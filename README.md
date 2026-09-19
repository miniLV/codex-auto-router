<h1 align="center">Jev Auto Router</h1>
<p align="center">
  <img src="assets/auto-router-cover.png" alt="Jev Auto Router plugin cover" width="420">
</p>
<p align="center">
  <strong>Jev 负责选路，Policy Guard 负责验证，Codex 负责执行，Root 负责验证与验收。每个 Main Task 自动过一次路由门，交付全程可恢复、可审计。</strong>
</p>

<p align="center">
  这是一条 Jev 原生、Codex 原生的能力路由工作流。你带来目标与约束；Root（<code>gpt-6-astra</code> 或 <code>gpt-5.6-sol</code>）拥有需求、架构、分解与验收；Jev 是唯一的自动选路大脑。
</p>

<p align="center">
  <a href="https://github.com/miniLV/jev-auto-router">GitHub</a> ·
  <strong>简体中文</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#快速开始"><strong>快速开始</strong></a> ·
  <a href="#路由"><strong>路由</strong></a> ·
  <a href="#收益怎么看"><strong>收益怎么看</strong></a> ·
  <a href="#更新"><strong>更新</strong></a>
</p>

> 本项目由 `codex-auto-router` 更名而来（架构重置见 [ADR 0013](docs/adr/0013-jev-native-routing-architecture.md)）；仓库已迁移到 `miniLV/jev-auto-router`。

## 快速开始

前置条件：装有插件的当前版 Codex CLI，Root 会话为 GPT-6 Astra 或 GPT-5.6 Sol 的 Medium 或更高（从可信的当前任务 runtime metadata 确认），以及 `spawn_agent` 原生委派面。模型与 lane 的访问只在路由真的委派时才需要。**不需要 `jq`，也不需要安装任何 companion 角色** —— 模型、effort 与 fresh context 全部通过 `spawn_agent` 参数逐次指定。

```sh
codex plugin marketplace add miniLV/jev-auto-router --ref main
codex plugin add jev-auto-router@jev-auto-router
```

这个 marketplace 跟随 `main`，便于直接获得当前版本；需要不可变版本的团队应在发布 tag 后把 `main` 换成对应 tag。

**当前状态：架构预览（static contract）。** Jev 选路运行时（JevAdapter、Policy Guard、生命周期）正在按 [task.md](task.md) 实施中；当前仓库交付的是完整的规范契约、Skill 静态流程与观察者 Dashboard。契约安装后 Root 会按本 Policy 解释执行（Jev 不可用时一切任务自动落在 Root），完整的自动 Jev 路由要等 P2–P4 落地。也可以显式点名：

```text
Use $jev-auto-router:jev-auto-router to build this feature and verify it.
```

### 可选加固：安装 Reviewer profile（非必需）

核心路由与语义 review 都不需要它。只有当你的 Codex 版本暴露"按名字选择已安装 custom agent"的 spawn 参数时，安装它才有额外收益 —— 那时 reviewer 可以拿到 profile 里请求的 `read-only` sandbox。

```sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
```

它只安装一个 allowlisted TOML（`jev-auto-router-astra-reviewer.toml`），内容相同则幂等成功，内容不同会拒绝覆盖。`--check` 只证明已安装文件与随附模板逐字节一致，**不证明** reviewer 已启动、fresh context 已获得或 sandbox 已生效。安装后需新建一条 task，custom agent 在 task 创建时被发现。

## 你要做什么

把结果、约束和重要的仓库上下文交给 Root。你不需要选择或管理 lane；Root 从可信的当前任务 metadata 确认自己为 `Astra` 或 `Sol` 的 `Medium` 或更高，把实现单元写成有界的 Task Capsule，然后把选路交给 Jev、把治理交给 Guard，并拥有验证与验收。

## 路由

每个实现单元的路线只有两种结局：Root 自己执行（`ROOT_DIRECT`），或按一条被 Guard 放行的 RoutePlan 委派执行。没有固定 lane，没有"单文件去便宜模型、其他都去大模型"的形状启发式。

```text
Task Capsule（五段模板 + 三条机械检查）
  → Runtime Capability Catalog（只收录本机真实观测到的能力）
  → RouteRequest → JevAdapter → Jev → RoutePlan
  → Policy Guard：ALLOW 才执行，DENY 一律回到 Root
  → Codex 原生执行（记录 requested vs observed）
  → Root 机械验证 →（风险触发时）fresh 独立语义 review → Root 验收
```

- **Jev 是唯一的自动选路者**：选 root 还是委派、模型、effort、agent、Skill、MCP、工具面、context 策略、续跑策略。Jev 超时、报错、输出无效或置信度不足时，自动委派不可用，Root 接手 —— 降级，不断路。
- **Policy Guard 只有否决权，没有改道权**：它校验 schema、置信度、能力存在性、所有权有界、用户授权、验证具体、baseline 可恢复、最小权限、无越权副作用、无子 agent 扇出、benchmark 资格和预算；结论只有 `ALLOW(RoutePlan)` 或 `DENY(reason) → Root`。
- **UNKNOWN 永远不是 MATCH**：每次执行都记录 requested vs observed（model、effort、agent、sandbox、权限等）。更贵但正确的产物可以采用但不计入节省证据；更弱或越权的权限是安全事件 —— 恢复、停委派、Root 接手。
- **预算**：每个 Main Task 硬上限 3 次工作执行、自动经济上限 2 次；第三次执行需要该任务形态的 benchmark 资格，否则 Root 接手。

语义 review 不是一种模式，而是风险触发：改动持久化，且触及公开接口／数据结构／权限或安全路径，或子 agent 报了非空 `JUDGMENT CALLS` / `GAPS` 时，才派发一次 fresh 的 `gpt-6-astra` / `medium` reviewer。每个候选最多一次；它返回 `ACCEPT` / `REVISE` / `RECONSIDER`，隔离强度按观测证据分级（`ENFORCED_READ_ONLY` / `BEHAVIORALLY_READ_ONLY` / `REVIEW_UNAVAILABLE`），任何 verdict 之后的改动都会使 verdict 失效。

完整规则见 [Runtime Router Policy](skills/jev-auto-router/references/routing-policy.md)（唯一权威），架构说明见 [docs/solution.md](docs/solution.md)，历史决策见 [docs/adr](docs/adr/README.md)。

## 自动发生什么

Root 把架构、分解、Task Capsule、机械验证、升级决策和验收全部留在主任务。子 agent 的工作是替代 Root 执行，不是复制它。

- **派发门是一份必填模板，不是判断题**：OBJECTIVE / FILES AND OWNERSHIP / INTERFACES / CONSTRAINTS / VERIFICATION 五段都要能具体填满，其中三条是纯机械检查 —— 每个 owned path 能解析、每条验证命令 Root 已先跑过并记录结果、仓库干净且 baseline 已存。任何一条不成立就不可委派。
- **请求了不等于生效了**：派发后逐项比对观测到的 model 与 effort 等。平台报告不一致时按安全/归因分轨处理；平台不暴露该元数据时不因此丢弃已验证产出 —— 只记录残余风险，且永不计入已验证节省。
- **同时只有一个 active child**，child 不能再生 child；reviewer 与 worker 永不并存。
- **恢复优先**：失败先恢复 baseline 再决定纠正或接管；从不为了不计数而悄悄修补被拒的补丁。同 worker 续跑只在运行时证据可证明（句柄、身份、所有权、runtime 契约）时可选。

## 收益怎么看

路由试图省的是什么：**在 benchmark 已证明的任务形态里，把机械、可验证的执行 token 从旗舰模型（Astra）挪到更便宜的执行面，让 Astra 的 token 与 effort 集中在判断、验证与验收上**。这不是已实现的普遍节省承诺 —— 端到端节省依赖 benchmark 资格，Task Capsule、冷启动、Root 验收与恢复都必须计入成本（见 [benchmark 契约](docs/sdd/benchmark.md)）。

有三个观测面可以把收益读出来。它们都只是**观察者**：按 Policy 的设计，Dashboard、`ccusage`、Credit 估算、model mix 和时延永远不回流为路由输入，所以这些读数是复盘证据，不是控制回路。

1. **Model mix 份额迁移**（最直接）。本地会话的 token share 随使用演进：委派真的发生时，非旗舰模型的 token share 上升、Astra 份额下降。页面 **Per-task usage** 表还能看到逐 task 的按模型消耗明细。

   ```sh
   npm run setup
   npm run dashboard
   ```

   前置条件是 Node.js 22+ 和已登录的 Codex CLI。页面区分 **Subscription usage** 与 **Credit**，`Model mix` 来自本地 session token share，不是官方逐任务账单。**Per-task usage** 表按最近时间列出每个本地 session（≈ 一个 task）的按模型 token 消耗与 task 总量，不显示 prompt、sessionId 或目录。

   ![Jev Auto Router 本地 Dashboard：订阅配额与按模型份额](docs/assets/jev-auto-router-dashboard.png)

2. **逐会话 token 归因**。`ccusage` 作为项目内精确锁定依赖安装，直接按模型读会话 token：

   ```sh
   npm run ccusage -- codex session --json --since <date> --until <date>
   ```

3. **A/B 对照**（最干净）。同一个任务跑两次：一次禁用本插件、一次启用。比较两条会话的 token 总量、模型分布与墙钟时间 —— 差值就是路由的实际影响。

诚实的边界：订阅 quota 只暴露百分比，**没有官方逐任务 Credit**；Credit 模式下的归因是 token-share 近似（Dashboard 会标 `estimated`）。所以收益的读数是"份额迁移与趋势"，不是精确到任务的账单；未通过 benchmark 资格前，不宣称自动节省。

## 更新

更新 marketplace 插件即可；没有 companion 角色需要重装。如果装过 reviewer profile，重跑一次 `--check` 确认它仍然与随附模板逐字节一致，然后新建一条 task：

```sh
codex plugin marketplace upgrade jev-auto-router
codex plugin add jev-auto-router@jev-auto-router
sh skills/jev-auto-router/scripts/install-reviewer-agent.sh --check
```

本地开发时，把本 checkout 作为 marketplace 安装：

```sh
cd /absolute/path/to/jev-auto-router
codex plugin marketplace add /absolute/path/to/jev-auto-router
codex plugin add jev-auto-router@jev-auto-router
```

## 发布

发布者先在本地创建版本提交和 tag，再一起推送（仓库重命名后确认 remote 指向 `miniLV/jev-auto-router`）：

```sh
npm run release -- 0.2.0
git push origin master v0.2.0
```

发布脚本会同步 `package.json`、`package-lock.json`、插件 manifest 和 marketplace 指向的 tag，并运行完整测试。tag 推送会触发 GitHub Actions：使用 Node 22 复核版本一致性、跑测试与 typecheck，再创建 GitHub Release。公开 Plugins Directory 仍需在 OpenAI 提交门户审核和发布。

## 验证

```sh
npm test
npm run typecheck
git diff --check
```

测试覆盖路由契约、Task Capsule 门、Guard 校验、执行契约、预算上限、review 触发条件、身份一致性（含旧身份残留清扫）、profile 精确性、Dashboard 隔离和本地 `ccusage` 适配。它只验证静态契约，不证明任何一次真实派发、Jev 调用或 review 已经发生。

## 隐私与边界

- Dashboard 只绑定 `127.0.0.1`，只读运行，不反向控制路由。
- 原始 Codex session logs 保留在本机原位置；本地模型归因只读取已有日志，不上传 session。
- 本仓库提供 Codex skill、静态契约与 Jev 接入 seam，不是独立的后台调度服务。
- 订阅模式导出的 JSON 使用 `officialCredit.kind = "subscription-quota"` 和 `localModelShare`；只有 Credit 模式才在 `estimatedCreditAttribution` 中提供 `credits`。协议见 [Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)。

## License

本项目采用 [Apache License 2.0](LICENSE)。
