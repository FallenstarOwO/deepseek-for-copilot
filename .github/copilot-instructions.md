# 仓库约定

## 身份与发布

- 本仓库是 `Vizards/deepseek-v4-for-copilot` 的社区分支。当前标识：`publisher=fallenstarowo`、`name=deepseek-for-copilot`，即扩展 ID `fallenstarowo.deepseek-for-copilot-chat`。
- 版本与 CHANGELOG 由 release-please 管理（[release-please-config.json](./release-please-config.json) + [release-please-manifest.json](./release-please-manifest.json)）。不要手改 CHANGELOG 的历史条目，也不要与 release 自动开的 PR 抢同一批文件。只有手动发版时才改 `package.json` 版本并打 tag。
- 发布凭据是 `VSCE_PAT` / `OVSX_PAT` 两个 secret（见 [workflows/release.yml](./workflows/release.yml)）。上游用的 Entra 联合身份与 Open VSX trusted publishing 不适用于本仓库。
- 品牌与发布相关改动集中在单一提交，保持 `main = upstream/main + 一个 fork 定制提交`，方便 `git rebase upstream/main` 同步上游。上游远端需手动添加：`git remote add upstream https://github.com/Vizards/deepseek-v4-for-copilot.git`。

## 代码约定

- 模型注册表在 [src/consts.ts](../src/consts.ts) 的 `MODELS`。`deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 已移除（官方 API 早把旧 ID 路由到 V4.1 Flash），不要再加回。
- Vision Proxy 自动模式的默认模型是 `deepseek-flash`（[src/provider/vision/consts.ts](../src/provider/vision/consts.ts) 的 `DEFAULT_VISION_MODEL_ID`），V4 Pro 走代理。改这个默认值要同步 `package.nls*.json`、README 与 `src/i18n.ts`。
- 扩展在激活阶段同步注册 provider，等 Copilot Chat 激活完成后再刷新模型列表（[src/runtime/provider.ts](../src/runtime/provider.ts)）。不要改回 `await activate()`，那会复现上游 #274 的激活死锁。
- 校验命令：`npm run compile`、`npm run lint`、`npm run package`。`package` 的 `vscode:prepublish` 依赖 bash，Windows 下需把 `C:\Program Files\Git\bin` 加入 PATH。`npm run format:check` 全仓存在历史性的 CRLF 失败，不作为门禁。

## 迭代注意

- 更换扩展 ID 会得到全新的 SecretStorage，用户 API Key 不会迁移，需重新执行 `DeepSeek: Set API Key`。
- 与官方版同时安装会因命令 ID 重复报 `command '<id>' already exists`，导致新扩展激活失败。发布说明需提示先卸载官方版。
- Agents 窗口模型可见性问题的排查口径见 `agent-config` 技能的「BYOK 故障速查」：Cloud 会话不支持第三方 BYOK，必须切到本地 Copilot 会话类型。
