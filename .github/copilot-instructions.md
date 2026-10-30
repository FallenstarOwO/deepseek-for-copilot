# 仓库约定

## 身份与发布

- 本仓库是 `Vizards/deepseek-v4-for-copilot` 的社区分支。当前标识：`publisher=fallenstarowo`、`name=deepseek-for-copilot-chat`、`displayName=DeepSeek for Copilot Chat (Community Fork)`，即扩展 ID `fallenstarowo.deepseek-for-copilot-chat`。
- 版本与 CHANGELOG 由 release-please 管理（[release-please-config.json](./release-please-config.json) + [release-please-manifest.json](./release-please-manifest.json)）。不要手改 CHANGELOG 的历史条目，也不要与 release 自动开的 PR 抢同一批文件。只有手动发版时才改 `package.json` 版本并打 tag。
- 品牌与发布相关改动集中在单一提交，保持 `main = upstream/main + 若干 fork 定制提交`，方便 `git rebase upstream/main` 同步上游。上游远端需手动添加：`git remote add upstream https://github.com/Vizards/deepseek-v4-for-copilot.git`。

## 发布链路

- **Marketplace 只用 Trusted Publishing（GitHub OIDC），不存任何长期凭据。** [workflows/release.yml](./workflows/release.yml) 的发布步骤是 `vsce publish --oidc`，依赖两件事：job 里有 `permissions: id-token: write`，以及 `@vscode/vsce >= 4.1.0`（4.0.0 没有 `--oidc`）。本地兜底发布仍可用 PAT：`npx vsce login fallenstarowo` 后 `npx vsce publish --packagePath <vsix>`。
- Marketplace 侧的策略必须与 workflow 精确匹配，任一字段不符即 token exchange 失败：Repository owner `FallenstarOwO`、Repository `deepseek-for-copilot`、Workflow `release.yml`、Environment `production`。两个发布 job 都声明了 `environment: production`，改 workflow 时不要顺手删掉。
- 发布流程：`feat`/`fix` 提交进 `main` → release-please 开 release PR → 合并后自动打 tag → `publish` job 上传 Marketplace 并把 VSIX 附到 GitHub Release。`workflow_dispatch` 是手动救援入口，必填 `tag_name`。
- **Open VSX 已下线**：徽章、安装说明、`ovsx` 依赖与 workflow 步骤均已移除，不要再加回。
- **扩展名必须全局唯一**。Marketplace 的 `name` 不是发布者内唯一，`deepseek-for-copilot` 已被他人占用，displayName 也需与既有扩展拉开差距（`(Community Fork)` 后缀是过审的有效形式）。改名时同步 `package-lock.json`、`src/consts.ts` 的 `WALKTHROUGH_ID`、README 徽章与安装链接、`package.nls*.json` 与 walkthrough 文案。
- 仓库 Settings 必须保持 **Allow GitHub Actions to create and approve pull requests** 开启，否则 release-please 无法开 release PR。

## 代码约定

- 模型注册表在 [src/consts.ts](../src/consts.ts) 的 `MODELS`。`deepseek-v4-flash` 与旧的视觉实验模型 ID 已移除（官方 API 早把旧 ID 路由到 V4.1 Flash），不要再加回。
- 扩展在激活阶段同步注册 provider，等 Copilot Chat 激活完成后再刷新模型列表（[src/runtime/provider.ts](../src/runtime/provider.ts)）。不要改回 `await activate()`，那会复现上游 #274 的激活死锁。
- 校验命令：`npm run compile`、`npm run lint`、`npm run package`。`package` 的 `vscode:prepublish` 依赖 bash，Windows 下需把 `C:\Program Files\Git\bin` 加入 PATH。`npm run format:check` 在本地 Windows 检出上会因 CRLF 全仓失败（属历史基线，CI 上正常），不作为本地门禁。

## 迭代注意

- 更换扩展 ID 会得到全新的 SecretStorage，用户 API Key 通常需要重新执行 `DeepSeek: Set API Key`。实测 2026-10-30：同发布者下改名（`fallenstarowo.deepseek-for-copilot` → `fallenstarowo.deepseek-for-copilot-chat`）后新 ID 的密钥库**仍保留**了 key，卸载重装后无需重设；但不要依赖这一点，换发布者或换策略时必须验证。
- 与官方版同时安装会因命令 ID 重复报 `command '<id>' already exists`，导致新扩展激活失败。发布说明需提示先卸载官方版。
- 本地验证扩展是否真正工作，看 `%APPDATA%\Code\logs\<最新时间戳>\window1\exthost\<扩展ID>\DeepSeek.log` 里的 `[background] tokens: model=deepseek-flash ...` 行；有 token 统计即代表请求走通。
- Agents 窗口模型可见性问题的排查口径见 `agent-config` 技能的「BYOK 故障速查」：Cloud 会话不支持第三方 BYOK，必须切到本地 Copilot 会话类型。
