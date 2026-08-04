<h1 align="center">Codex Auto Router</h1>
<p align="center">
  <img src="assets/auto-router-cover.png" alt="Codex Auto Router plugin cover" width="420">
</p>
<p align="center">
  <strong>让 Codex 的 Main Task 在质量、成本和安全边界之间自动分流。</strong>
</p>

<p align="center">
  Root 保留高判断质量；Terra / Luna 负责更轻量、更高性价比的有界后台执行。
</p>

<p align="center">
  <a href="https://github.com/miniLV/codex-auto-router">GitHub</a> ·
  <strong>简体中文</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#安装-skill"><strong>安装 Skill</strong></a> ·
  <a href="#核心流程"><strong>核心流程</strong></a> ·
  <a href="#可选本地-dashboard"><strong>可选 Dashboard</strong></a>
</p>

## 它解决什么

AI 编程助手不应该把每个任务都交给最贵的模型，也不应该为了省成本牺牲 Root 的判断和最终验证。这个项目把两件事分开：

- **Root / 当前模型保质量**：保留用户意图、授权解释、复杂判断、外部动作、整合、最终验证和交付。
- **Terra / Luna 降成本**：只把独立、有界、可恢复、可确定性验证的执行单元放到后台；通常更轻量、更快，也更适合重复性工程工作。
- **安全优先于价格**：成本不是单独的路由条件。只要边界、baseline、恢复路径或验收方式不清楚，就回到 `ROOT_DIRECT`。
- **本地可审计**：路由规则、派发模板和生命周期都在仓库内；另有可选 Dashboard，不依赖黑盒调度服务。

> **Root 配置：** 只有 `Sol` 且 reasoning effort 为 `Medium` 或更高时，才允许后台路由。Skill 不会切换、升级或降级 Root；非 Sol、`Low` 或无法从可信运行时确认的 Root tuple 使用 `ROOT_DIRECT`。

### 为什么现在值得路由

下图把取舍画得更直接：越靠左上，单位任务成本越低、能力越高。Sol 适合高判断工作，Luna 适合低风险执行，Terra 位于两者之间；路由的价值就是在边界清楚时选对模型。

[![GPT-5.6 Sol、Terra、Luna 的能力与单任务成本对比](docs/assets/gpt-models.avif)](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)

这正是本项目的价值：不是把任务盲目降级，而是在 Gate、精确路径、baseline、恢复与确定性验证都满足时，才把执行从当前 Root 分流到 Luna 或 Terra。订阅制 Codex 的官方 Credit 与 API token 账单是两条不同口径；Dashboard 会明确显示数据源，绝不把 API 单价伪装成订阅额度的线性换算。模型定位见 [OpenAI GPT-5.6 发布说明](https://openai.com/index/gpt-5-6/)，图表与独立分析来自 [Artificial Analysis](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)。

## 安装 Skill

使用 plugin 安装。它不需要 Node 服务、Dashboard 或 `ccusage`：

```sh
codex plugin marketplace add miniLV/codex-auto-router --ref main
codex plugin add codex-auto-router@codex-auto-router
```

这个 marketplace 跟随 `main`，便于直接获得当前版本；需要不可变版本的团队应在发布 tag 后把 `main` 换成对应 tag。

**到这里就可以用了。** 新建一条 Codex task 即生效 —— 不需要安装 custom agent、不需要 `jq`、不需要 Node 服务或 Dashboard。模型、reasoning effort 和 fresh context 都通过 `spawn_agent` 的参数指定，不依赖任何用户目录里的配置文件。

## 核心流程

每个 Main Task 会自动**考虑一次**，但考虑不等于委派：

1. Root 先保留用户目标、授权和约束。
2. 从可信的当前任务 metadata 确认 Root 为 `Sol / Medium` 或更高；Router 不改变它。
3. 读取唯一的 Runtime Router Policy，并检查完整 Gate。
4. Root profile 或 Gate 不通过，或任务需要判断、外部操作、破坏性操作、强上下文协作时，使用 `ROOT_DIRECT`。
5. Gate 通过后，只有两个明确的后台 tuple：

| 路由 | 模型 tuple | 适用范围 |
| --- | --- | --- |
| `ROOT_DIRECT` | 当前 Root 模型 | 判断类工作、外部动作，以及任何机械门未通过的情况 |
| `LUNA` | `gpt-5.6-luna` · `xhigh` · `fork_turns: none` | 只读证据窗口，或单文件、不动接口、单条二元验证的有界写入 |
| `TERRA` | `gpt-5.6-terra` · `high` · `fork_turns: none` | 其他通过门的有界实现 |

6. 派发门是**一份必填模板**而不是判断题：五段式 spec 的每一段都要能被具体填满，其中"每个 owned path 能解析"、"每条验证命令 Root 已经先跑过一遍并记录结果"、"仓库干净且 baseline 已存"三条是纯机械检查。任何一条不成立就自己做。
7. 一个 Main Task 最多派发 5 次：原始一次，加上最多 4 次改过 spec 的重试（禁止原样重派）。第 5 次仍不通过则恢复 baseline，由 Root 在原授权范围内完成。
8. 同时只有一个 active child，且 child 不能再生 child。子 agent 结束并解决归属之后才可能启动语义 review，因此 reviewer 与 worker 永不并存。
9. 回收时先做 Root 机械验证（自己读完整 diff，重跑子 agent 改动可能影响的验证命令，未受影响的命令复用派发前记录的结果）。只有在改动是持久化的、且触及公开接口／数据结构／权限或安全路径，或子 agent 报了非空 `JUDGMENT CALLS` / `GAPS` 时，才额外跑语义 review：每个候选最多一次、整个 Main Task 最多 5 次。它同时判断 diff 是否成立、以及 spec 本身是否足以达成目标，返回 `ACCEPT` / `REVISE` / `RECONSIDER`。跨多文件本身不是触发条件。按规则跳过 review 不等于"已审查"。

### 为什么 Root 不应该承担所有执行

当 Root 使用 Sol 等高能力模型时，它更适合保留高判断、复杂上下文和最终责任；让它承担每个机械、可复现的后台单元会增加成本。Terra 和 Luna 用更低的执行成本覆盖清晰、可验证的工作；这不是无条件降级：

- Luna 只处理可机械核对形态的任务。
- Terra 承担其他通过门的有界实现。
- 派发前每个写路径都有 baseline；子 agent 失败或产出无法验证时，恢复 baseline 由 Root 接手，而不是继续派。
- 请求了某个 tuple 不等于它生效了：派发后比对**观测到的** model 与 effort。平台报告了不一致就不接受产出；平台根本不暴露该元数据时不因此丢弃产出——机械验证和语义 review 本就从产物本身推导正确性，此时只记录残余风险。
- 恢复候选并由 Root 接手不算终止用户目标，无需重新授权；只有扩大 scope、改架构或开启新的委派工作才需要。

完整规则见 [Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md)。

### 可选：安装 Reviewer profile（加固，非必需）

核心路由与语义 review 都不需要它。只有当你的 Codex 版本暴露"按名字选择已安装 custom agent"的 spawn 参数时，安装它才有额外收益 —— 那时 reviewer 可以拿到 profile 里请求的 `read-only` sandbox。

```sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh
sh skills/codex-auto-router/scripts/install-reviewer-agent.sh --check
```

它只安装一个 allowlisted TOML，内容相同则幂等成功，内容不同会拒绝覆盖。`--check` 只证明已安装文件与随附模板逐字节一致，**不证明** reviewer 已启动、fresh context 已获得或 sandbox 已生效。安装后需新建一条 task，custom agent 在 task 创建时被发现。

若该 spawn 参数不存在，reviewer 就用 per-spawn 参数创建、sandbox 继承自 Root，此时只在不要求硬隔离、prompt 禁止编辑、且 Root 比对前后状态的前提下继续，并把更宽的 sandbox 记为残余风险。两条路都不会冒充另一条。

### 为什么不按时间或 Dashboard Credit 路由

当前没有可信的逐 task Credit 输入，Policy 也不做任何成本估算：委派与否只取决于任务形态能否通过机械门。Dashboard、`ccusage`、`src/credit.ts`、Credit 估算和 model mix 都明确不是 routing input；时延只作为独立约束。

## 验证

```sh
npm test
npm run typecheck
git diff --check
```

测试覆盖路由契约、模型 tuple、派发模板、五次派发／review 上限、review 触发条件、profile exactness、Dashboard 隔离和本地 `ccusage` 适配。它只验证静态契约，不证明任何一次真实派发或 review 已经发生。

## 隐私与边界

- Dashboard 只绑定 `127.0.0.1`。
- 原始 Codex session logs 保留在本机原位置。
- 本地模型归因只读取已有日志，不上传 session。
- 本仓库提供 Codex skill 与静态契约，不是独立的后台调度服务。

## 可选：本地 Dashboard

Dashboard 不是使用 skill 的前置条件。只有想在本机查看订阅 quota、Credit 状态和 Sol/Terra/Luna token share 时才需要它：

```sh
git clone https://github.com/miniLV/codex-auto-router.git
cd codex-auto-router
npm run setup
npm run dashboard
```

前置条件是 Node.js 22+ 和已经登录的 Codex CLI；`ccusage` 会作为项目内精确锁定依赖安装，不要求全局命令。打开终端打印的 `127.0.0.1` 地址即可查看页面。

页面会明确区分 **Subscription usage** 与 **Credit**，不会和 OpenAI Platform API token 账单混算。**Model mix** 来自本地 session token share，不是官方逐任务账单。刷新失败时，底部 **Debug log** 与 **Copy debug** 可直接复制安全诊断快照。

![Codex Auto Router 本地 Dashboard：订阅配额与 Luna 44.9%、Terra 31.0%、Sol 24.1% 的模型份额](docs/assets/codex-auto-router-dashboard.png)

订阅模式导出的 JSON 使用 `officialCredit.kind = "subscription-quota"` 和 `localModelShare`；只有 Credit 模式才会在 `estimatedCreditAttribution` 中提供 `credits`。Dashboard 只绑定 `127.0.0.1`、只读运行，也不会反过来控制路由。协议见 [Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)。

## License

本项目采用 [Apache License 2.0](LICENSE)。
