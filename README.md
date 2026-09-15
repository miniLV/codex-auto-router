<h1 align="center">Codex Auto Router</h1>
<p align="center">
  <img src="assets/auto-router-cover.png" alt="Codex Auto Router plugin cover" width="420">
</p>
<p align="center">
  <strong>Astra / Medium+ 运筹全局。每个 Main Task 自动过一次路由门：判断与验收留在 Root，通过机械门的有界执行默认交给一条后台 lane。</strong>
</p>

<p align="center">
  这是一条 Codex 原生的能力路由工作流。你带来目标与约束；Root（<code>gpt-6-astra</code> 或 <code>gpt-5.6-sol</code>）拥有计划、派发、验证与验收。
</p>

<p align="center">
  <a href="https://github.com/miniLV/codex-auto-router">GitHub</a> ·
  <strong>简体中文</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#快速开始"><strong>快速开始</strong></a> ·
  <a href="#路由"><strong>路由</strong></a> ·
  <a href="#收益怎么看"><strong>收益怎么看</strong></a> ·
  <a href="#更新"><strong>更新</strong></a>
</p>

## 快速开始

前置条件：装有插件的当前版 Codex CLI，Root 会话为 GPT-6 Astra 或 GPT-5.6 Sol 的 Medium 或更高（从可信的当前任务 runtime metadata 确认），以及 `spawn_agent` 原生委派面。GPT-5.6 Luna / Terra 的访问只在选中路由真的委派时才需要。**不需要 `jq`，也不需要安装任何 companion 角色** —— 模型、effort 与 fresh context 全部通过 `spawn_agent` 参数逐次指定。

```sh
codex plugin marketplace add miniLV/codex-auto-router --ref main
codex plugin add codex-auto-router@codex-auto-router
```

这个 marketplace 跟随 `main`，便于直接获得当前版本；需要不可变版本的团队应在发布 tag 后把 `main` 换成对应 tag。

**到这里就可以用了。** 每条新 Codex task 会自动考虑一次路由，不需要任何提示词；也可以显式点名：

```text
Use $codex-auto-router:codex-auto-router to build this feature and verify it.
```

### 可选加固：安装 Reviewer profile（非必需）

核心路由与语义 review 都不需要它。只有当你的 Codex 版本暴露"按名字选择已安装 custom agent"的 spawn 参数时，安装它才有额外收益 —— 那时 reviewer 可以拿到 profile 里请求的 `read-only` sandbox。

```sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh --check
```

它只安装一个 allowlisted TOML（`codex-auto-router-astra-reviewer.toml`），内容相同则幂等成功，内容不同会拒绝覆盖。`--check` 只证明已安装文件与随附模板逐字节一致，**不证明** reviewer 已启动、fresh context 已获得或 sandbox 已生效。安装后需新建一条 task，custom agent 在 task 创建时被发现。

## 你要做什么

把结果、约束和重要的仓库上下文交给 Root。你不需要选择或管理 lane；Root 从可信的当前任务 metadata 确认自己为 `Astra` 或 `Sol` 的 `Medium` 或更高，记录路由结论，并拥有验证与验收。

## 路由

| 路由结论 | 什么时候 | 交付方式 |
| --- | --- | --- |
| `ROOT_DIRECT` | 默认；风险未受控，或五段式模板任何一段填不具体。 | Root 自己计划、实现、测试、自审并交付。 |
| `LUNA` | 有界且完全可机械核验：只读证据窗口，或单文件（同目录同类）写入、不动公开接口、一条二元验证命令。 | `gpt-5.6-luna` · `max` · `fork_turns: none`；Root 机械验证。 |
| `TERRA` | 其他通过门的有界实现：判断更多、风险更高、跨文件。 | `gpt-5.6-terra` · `high` · `fork_turns: none`；Root 机械验证。 |

`ROOT_DIRECT` 不是为省钱选的路线，而是本契约所有失败路径的终点。路由按**任务性质**分流（实现 vs 判断），不按感知难度；一个复杂但纯机械的重构照样委派，一个取决于用户意图的琐碎问题照样留在 Root。

语义 review 不是一种模式，而是风险触发：改动持久化，且触及公开接口／数据结构／权限或安全路径，或子 agent 报了非空 `JUDGMENT CALLS` / `GAPS` 时，才派发一次 fresh 的 `gpt-6-astra` / `medium` reviewer。每个候选最多一次、每个 Main Task 最多五次；它返回 `ACCEPT` / `REVISE` / `RECONSIDER`。

## 自动发生什么

Root / Astra 把架构、分解、路由结论、派发模板、机械验证、升级决策和验收全部留在主任务。子 agent 的工作是替代 Root 执行，不是复制它。

- **派发门是一份必填模板，不是判断题**：OBJECTIVE / FILES AND OWNERSHIP / INTERFACES / CONSTRAINTS / VERIFICATION 五段都要能具体填满，其中三条是纯机械检查 —— 每个 owned path 能解析、每条验证命令 Root 已先跑过并记录结果、仓库干净且 baseline 已存。任何一条不成立就自己做。
- **一个 Main Task 最多 5 次派发**：原始一次，加最多 4 次改过 spec 的重试（禁止原样重派）。每次派发前，所有写路径都有 baseline；失败或产出不可验证时，恢复 baseline 由 Root 接手，而不是继续派。
- **请求了 tuple 不等于它生效了**：派发后比对观测到的 model 与 effort。平台报告不一致就不接受产出；平台不暴露该元数据时不因此丢弃产出 —— 机械验证和语义 review 本就从产物本身推导正确性，此时只记录残余风险。
- **同时只有一个 active child**，child 不能再生 child；reviewer 与 worker 永不并存。
- **升级永不静默降级**：Root 可以在新观测到的风险出现时升级通道，但不会悄悄把 TERRA 降成 LUNA、把委派降成 `ROOT_DIRECT` 而不记录。

完整规则见 [Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md)（唯一权威），架构说明见 [docs/solution.md](docs/solution.md)，历史决策见 [docs/adr](docs/adr/README.md)。

## 收益怎么看

路由省的是什么：**机械、可验证的执行 token 从旗舰模型（Astra）挪到更便宜的 lane（Terra / Luna），Astra 的 token 与 effort 集中在判断、验证与验收上**。模型之间的单价差是收益的原料 —— 越靠左上，单位任务成本越低、能力越高（[对比图](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)）。

有三个观测面可以把收益读出来。它们都只是**观察者**：按 Policy 的设计，Dashboard、`ccusage`、Credit 估算、model mix 和时延永远不回流为路由输入，所以这些读数是复盘证据，不是控制回路。

1. **Model mix 份额迁移**（最直接）。本地会话的 token share 随使用演进：委派真的发生时，Terra / Luna 的 token share 上升、Astra 份额下降。页面 **Per-task usage** 表还能看到逐 task 的按模型消耗明细。

   ```sh
   npm run setup
   npm run dashboard
   ```

   前置条件是 Node.js 22+ 和已登录的 Codex CLI。页面区分 **Subscription usage** 与 **Credit**，`Model mix` 来自本地 session token share，不是官方逐任务账单。**Per-task usage** 表按最近时间列出每个本地 session（≈ 一个 task）的按模型 token 消耗与 task 总量，不显示 prompt、sessionId 或目录。

   ![Codex Auto Router 本地 Dashboard：订阅配额与 Luna 44.9%、Terra 31.0%、Sol 24.1% 的模型份额](docs/assets/codex-auto-router-dashboard.png)

2. **逐会话 token 归因**。`ccusage` 作为项目内精确锁定依赖安装，直接按模型读会话 token：

   ```sh
   npm run ccusage -- codex session --json --since <date> --until <date>
   ```

3. **A/B 对照**（最干净）。同一个任务跑两次：一次禁用本插件、一次启用。比较两条会话的 token 总量、模型分布与墙钟时间 —— 差值就是路由的实际影响。

诚实的边界：订阅 quota 只暴露百分比，**没有官方逐任务 Credit**；Credit 模式下的归因是 token-share 近似（Dashboard 会标 `estimated`）。所以收益的读数是"份额迁移与趋势"，不是精确到任务的账单。这是契约的刻意取舍 —— 参见 [ADR 0012](docs/adr/0012-gate-delegation-with-a-template-not-a-cost-estimate.md)：派发门由任务形态决定，永远不由成本估算驱动。

## 更新

更新 marketplace 插件即可；没有 companion 角色需要重装。如果装过 reviewer profile，重跑一次 `--check` 确认它仍然与随附模板逐字节一致，然后新建一条 task：

```sh
codex plugin marketplace upgrade codex-auto-router
codex plugin add codex-auto-router@codex-auto-router
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh --check
```

本地开发时，把本 checkout 作为 marketplace 安装：

```sh
cd /absolute/path/to/codex-auto-router
codex plugin marketplace add /absolute/path/to/codex-auto-router
codex plugin add codex-auto-router@codex-auto-router
```

## 发布

发布者先在本地创建版本提交和 tag，再一起推送：

```sh
npm run release -- 0.1.3
git push origin master v0.1.3
```

发布脚本会同步 `package.json`、`package-lock.json`、插件 manifest 和 marketplace 指向的 tag，并运行完整测试。tag 推送会触发 GitHub Actions：使用 Node 22 复核版本一致性、跑测试与 typecheck，再创建 GitHub Release。公开 Plugins Directory 仍需在 OpenAI 提交门户审核和发布。

## 验证

```sh
npm test
npm run typecheck
git diff --check
```

测试覆盖路由契约、模型 tuple、派发模板、五次派发／review 上限、review 触发条件、profile exactness、Dashboard 隔离和本地 `ccusage` 适配。它只验证静态契约，不证明任何一次真实派发或 review 已经发生。

## 隐私与边界

- Dashboard 只绑定 `127.0.0.1`，只读运行，不反向控制路由。
- 原始 Codex session logs 保留在本机原位置；本地模型归因只读取已有日志，不上传 session。
- 本仓库提供 Codex skill 与静态契约，不是独立的后台调度服务。
- 订阅模式导出的 JSON 使用 `officialCredit.kind = "subscription-quota"` 和 `localModelShare`；只有 Credit 模式才在 `estimatedCreditAttribution` 中提供 `credits`。协议见 [Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)。

## License

本项目采用 [Apache License 2.0](LICENSE)。
