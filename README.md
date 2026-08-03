<h1 align="center">Codex Auto Router</h1>

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
  <a href="#3-分钟开始"><strong>3 分钟开始</strong></a> ·
  <a href="#核心流程"><strong>核心流程</strong></a> ·
  <a href="#本地页面怎么自查"><strong>自查成本</strong></a>
</p>

<p align="center">
  <img src="docs/diagrams/auto-routing-zh.png" alt="Codex Auto Router 中文手绘主流程图" width="900">
</p>

<sub>上图使用 <a href="https://github.com/miniLV/sketchboard-diagram">sketchboard-diagram</a> 绘制；对应的可编辑 HTML 在 <a href="docs/diagrams/auto-routing-zh.html">docs/diagrams/auto-routing-zh.html</a>。</sub>

## 它解决什么

AI 编程助手不应该把每个任务都交给最贵的模型，也不应该为了省成本牺牲 Root 的判断和最终验证。这个项目把两件事分开：

- **Sol / Root 保质量**：保留用户意图、授权解释、复杂判断、外部动作、整合、最终验证和交付。
- **Terra / Luna 降成本**：只把独立、有界、可恢复、可确定性验证的执行单元放到后台；通常更轻量、更快，也更适合重复性工程工作。
- **安全优先于价格**：成本不是单独的路由条件。只要边界、baseline、恢复路径或验收方式不清楚，就回到 `ROOT_DIRECT`。
- **本地可审计**：路由规则、Task Packet、生命周期和 Dashboard 都在仓库内；不依赖一个黑盒调度服务。

### 为什么现在值得路由

同一代模型已经有清晰的能力/成本台阶：公开 API 定价中，GPT-5.6 Sol 为每百万 token 输入 $5、输出 $30；Terra 为 $2.50 / $15；Luna 为 $1 / $6。也就是说，Terra 约为 Sol 的一半，Luna 约为其五分之一。把日志窗口读取、单测补齐等**有界且可机械验收**的单元交给合适模型，能让同一笔 API token 预算覆盖更多实际工作；一次无法验证的返工则足以吃掉这些节省。

这正是本项目的价值：不是把任务盲目降级，而是在 Gate、精确路径、baseline、恢复与确定性验证都满足时，才把执行从 Sol 分流到 Luna 或 Terra。订阅制 Codex 的官方 Credit 与 API token 账单是两条不同口径；Dashboard 会明确显示数据源，绝不把 API 单价伪装成订阅额度的线性换算。定价和模型定位见 [OpenAI GPT-5.6 发布说明](https://openai.com/index/gpt-5-6/)；能力/成本的独立比较见 [Artificial Analysis](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)。

## 3 分钟开始

前置条件：Node.js 22+，以及已经安装并登录的 Codex CLI。`ccusage` 由项目以精确版本安装，不要求全局命令：

```sh
# macOS / Linux
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# macOS / Homebrew
brew install codex

# Windows，或任何支持 npm 的平台
npm install --global @openai/codex

codex
codex --version
npm run setup
npm start
```

`npm run setup` 会检查 Node.js、npm 和 Codex CLI，安装锁定依赖，并验证项目内 `ccusage`、类型检查与测试。缺少系统前置条件时，它会打印手动安装命令后停止；不会安装全局工具。Dashboard 使用精确锁定的项目内 `ccusage` 读取 Codex session logs，不使用全局版本、`npx` 或运行时下载。

setup 完成后，用户可以直接使用 CLI：

```sh
npm run ccusage -- --version
npm run ccusage -- codex session --json --offline
```

## 核心流程

每个 Main Task 会自动**考虑一次**，但考虑不等于委派：

1. Root 先保留用户目标、授权和约束。
2. 读取唯一的 Runtime Router Policy，并检查完整 Gate。
3. Gate 不通过，或任务需要判断、外部操作、破坏性操作、强上下文协作时，使用 `ROOT_DIRECT`。
4. Gate 通过后，只有两个明确的后台 tuple：

| 路由 | 模型 tuple | 适用范围 |
| --- | --- | --- |
| `ROOT_DIRECT` | 当前 Root / Sol | 复杂判断、外部动作、不可验证或不值得拆分的工作 |
| `LUNA_XHIGH_BACKGROUND` | `gpt-5.6-luna` · `xhigh` · `fork_turns: none` | 仅 `READ_LOG_WINDOW`、`WRITE_UNIT_TESTS` |
| `TERRA_HIGH_BACKGROUND` | `gpt-5.6-terra` · `high` · `fork_turns: none` | 其他满足 Gate 的有界执行 |

5. 同一时间最多一个 child。完成后 Root 对照 baseline 检查 diff，运行确定性验证，再决定采纳或恢复。

### 为什么 Sol 不应该承担所有执行

Sol 更适合高判断、复杂上下文和最终责任，但把它用于每个机械、可复现的后台单元会增加成本。Terra 和 Luna 的定位是用更低的执行成本覆盖清晰、可验证的工作；这不是无条件降级：

- Luna 只处理精确白名单任务。
- Terra 承担其他通过 Gate 的有界执行，最多两次聚焦修复。
- Luna 失败后，Root 先解决其 diff，再最多创建一次新的 Terra；不会再次创建 Luna。
- 任意不确定都回到 Root。

完整规则见 [Runtime Router Policy](skills/codex-auto-router/references/routing-policy.md)、[Task Packet](skills/codex-auto-router/references/task-packet.md) 和 [Native Subagent Lifecycle](skills/codex-auto-router/references/native-subagent-lifecycle.md)。

## 本地页面怎么自查

运行 `npm start` 后，打开终端打印的 `127.0.0.1` 地址。页面中的 **Subscription usage** 读取 Codex app-server 的官方订阅配额；**Model mix** 是基于本地 token share 的观察，不是官方逐任务账单。项目调用 `account/rateLimits/read` 获取 `primary.usedPercent`、窗口时长和重置时间，并调用 `account/usage/read` 检查本地活动是否可用；不调用 OpenAI Platform API 的 token 账单接口。

页面顶部的 **Setup status** 会检查 Node.js、Codex CLI 和项目内 `ccusage`。三项都会显示版本或缺失原因；任一项未满足时，页面会给出修复命令。刷新失败时，页面底部的 **Debug log** 会保留错误与安全快照，可用 **Copy debug** 一次复制。

![Codex Auto Router 本地 Credit 页面](docs/assets/codex-auto-router-dashboard.png)

订阅模式下，页面会显示类似 `55% remaining · Weekly` 的当前窗口额度。旧版或企业 Credit 模式仍兼容 `individualLimit`，但两种口径不会混在一起。自查步骤：

1. 点击 **Refresh**，确认 Codex CLI 已登录，并等待 Model mix 出现模型列表。
2. 看 **Top local share** 和右侧模型列表；如果 Sol 长期占据大部分本地估算，而任务本应是机械、有界、可验证的，就检查路由 receipt 和任务拆分。
3. 用 **Export JSON** 保存当前快照：订阅模式看 `officialCredit.kind = "subscription-quota"`、`usedPercent`、`remainingPercent` 和 `localModelShare`；只有 Credit 模式才看 `estimatedCreditAttribution` 中的 `credits`。
4. 如果 `estimatedCreditAttribution` 和 `localModelShare` 都为空，先修复 Codex session / 数据源；不要把空数据误判为 Sol 成本为零。

Dashboard 只是只读观察器，不会反过来控制路由。订阅配额是窗口级官方状态，本地 model share 只能用来发现 Sol/Terra/Luna 的使用趋势，不能替代官方额度或账单。接口协议见 [Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)。

## 验证

```sh
npm test
npm run typecheck
git diff --check
```

测试覆盖路由契约、模型 tuple、Task Packet、生命周期边界、Dashboard 隔离和本地 `ccusage` 适配。

## 隐私与边界

- Dashboard 只绑定 `127.0.0.1`。
- 原始 Codex session logs 保留在本机原位置。
- 本地模型归因只读取已有日志，不上传 session。
- 本仓库提供 Codex skill 与静态契约，不是独立的后台调度服务。
