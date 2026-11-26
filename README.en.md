<h1 align="center">DeepSeek for Copilot Chat: BYOK</h1>

<p align="center">
  <!-- marketplace-readme:remove-start -->
  <a href="https://marketplace.visualstudio.com/items?itemName=fallenstarowo.deepseek-for-copilot-chat"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white&style=for-the-badge" alt="Install from VS Code Marketplace"></a>
  <br/>
  <!-- marketplace-readme:remove-end -->
  <img src="https://img.shields.io/github/v/release/FallenstarOwO/deepseek-for-copilot?style=for-the-badge&label=Version" alt="Version" />
  <img src="https://vsmarketplacebadges.dev/installs-short/fallenstarowo.deepseek-for-copilot-chat.svg?style=for-the-badge" alt="Installs" />
</p>

<p align="center">
  <a href="https://github.com/FallenstarOwO/deepseek-for-copilot/blob/main/README.md">简体中文</a> |
  English
</p>

**Pick DeepSeek from the Copilot Chat model picker — and keep agent mode, tool calling, and skills exactly as they are.**

## Models

| Model entry | Image input | Thinking level | API model ID |
|---|---|---|---|
| **DeepSeek V4.1 Flash** | ✅ native | `None` / `Low` / `High` / `Maximum` | `deepseek-flash` |
| **DeepSeek V4 Pro** | ❌ text only | `None` / `Low` / `High` / `Maximum` | `deepseek-v4-pro` |

Both support tool calling and a 1M token context; the thinking level is set per model from the settings pane in the model picker. See [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) for billing.

## Features

- **Inherits every Copilot capability** — agent mode, tool calling, instructions, MCP, and skills work as-is, because this plugs into Copilot's native provider API.
- **Thinking level** — `reasoning_content` is supported. `None` disables thinking; `Low` (`low`), `High` (`high`, default), and `Maximum` (`max`) set the reasoning depth.
- **Native vision** — Flash accepts image attachments directly ([context caching](https://api-docs.deepseek.com/guides/kv_cache/) needs an exact prefix match); Pro is text-only.
- **Web search and fetch** — `#deepseekSearch` / `#deepseekFetch` via the official [Search/Fetch APIs](https://api-docs.deepseek.com/guides/search). Billed per successful request; disable individually with `webTools.search.enabled` / `webTools.fetch.enabled`.
- **OCR** — `#deepseekOcr` via the official [OCR API](https://api-docs.deepseek.com/guides/ocr): gives Pro eyes, or extracts text from PDF/Word/PowerPoint/images. **Off by default** (`ocr.enabled`), billed per recognized page, and only processes **files** (workspace-relative or absolute); chat image attachments are not routed through OCR automatically.
- **Balance** — `DeepSeek: Check Balance` opens a panel (with a link to the [usage page](https://platform.deepseek.com/usage)); the status bar mirrors the balance and refreshes on click (`statusBar.balance.enabled` / `refreshIntervalMinutes`).
- **Secure and lightweight** — the API key lives in the OS keychain (`SecretStorage`), never in `settings.json`; pure VS Code API + Node built-ins, no extra process.

## Getting Started

**Prerequisites**: VS Code 1.116+ (this relies on non-public Copilot Chat APIs that may break on newer releases — [report an issue](https://github.com/FallenstarOwO/deepseek-for-copilot/issues) if you hit one), a GitHub Copilot subscription (the free tier works), and a [DeepSeek API key](https://platform.deepseek.com).

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=fallenstarowo.deepseek-for-copilot-chat), or download the `.vsix` from [GitHub Releases](https://github.com/FallenstarOwO/deepseek-for-copilot/releases) and use **Install from VSIX...**.
2. **Set the key**: run **DeepSeek: Set API Key** from the Command Palette and paste your key (official keys usually start with `sk-`).
3. **Chat**: open Copilot Chat, click the model picker, and choose **DeepSeek V4.1 Flash** or **DeepSeek V4 Pro**.

## Settings

All keys are prefixed with `deepseek-copilot.`.

| Setting | Default | Description |
|---|---|---|
| `baseUrl` | `https://api.deepseek.com` | API endpoint for self-hosted or proxied deployments. **User (machine) scope only** — workspace settings are ignored so a malicious repository cannot redirect your API key |
| `requestHeaders` | `{}` | Custom request headers, also **user scope only**. [Guide](https://github.com/Vizards/deepseek-v4-for-copilot/blob/main/docs/settings/request-headers.en.md) |
| `maxTokens` | `0` | Max output tokens (`0` = API default). Useful for cost control |
| `modelIdOverrides` | official ID map | API model IDs sent for each model entry; change only for compatible third-party APIs |
| `debugMode` | `minimal` | `minimal` reports usage only; `metadata` logs privacy-safe diagnostics; `verbose` writes full request dumps to disk (**contains sensitive prompt text**) |
| `experimental.stabilizeToolList` | `false` | Stabilizes the `tools` list to improve cache hits; more function definitions increase input tokens. Usually unnecessary with 64 or fewer tools |

Other switches: `webTools.search.enabled` / `webTools.fetch.enabled` (on), `ocr.enabled` (off), `statusBar.balance.enabled` / `statusBar.balance.refreshIntervalMinutes` (on / 5 minutes).

With a custom `baseUrl`, the target service must implement the endpoints you use: `POST /v1/tools/search`, `POST /v1/tools/fetch`, `POST /v1/tools/ocr`, and `GET /user/balance`. These tools always use your configured DeepSeek API key, regardless of the selected chat model.

Example `settings.json` for a compatible API proxy:

```json
{
  "deepseek-copilot.modelIdOverrides": {
    "deepseek-flash": "your-v4.1-flash-model-id",
    "deepseek-v4-pro": "your-pro-model-id"
  }
}
```

## Known Issues

- **Cloud sessions in the Agents window have no DeepSeek models**: Cloud sessions run in a GitHub-hosted sandbox and resolve models server-side, so third-party BYOK models cannot be used there and no setting changes that. Use the local **Copilot** session type instead; `chat.agentHost.byokModels.enabled` defaults to `true` in VS Code 1.146 and must be enabled explicitly on older releases.
- **Agents window activation**: since VS Code 1.146, extensions declaring `capabilities.agentsWindow.supported` are loaded by the Agents window by default (declared here since 1.0.0), so `extensions.supportAgentsWindow` is no longer needed. Earlier releases still require it.

## Compared to alternatives

| | This extension | Local proxy (e.g. LiteLLM) | Standalone DeepSeek extensions |
|---|---|---|---|
| Works inside Copilot Chat | ✅ | ✅ | ❌ separate UI |
| Agent mode, tools, skills | ✅ | ✅ | ⚠️ reimplemented |
| Vision support | ✅ native | ❌ | ❌ |
| No extra process to run | ✅ | ❌ | ✅ |
| One-click install | ✅ | ❌ | ✅ |
| API key in OS keychain | ✅ | ❌ | ⚠️ varies |

## Acknowledgements & License

A community fork of **[Vizards/deepseek-v4-for-copilot](https://github.com/Vizards/deepseek-v4-for-copilot)** by **Vizards**, published by `fallenstarowo` from [FallenstarOwO/deepseek-for-copilot](https://github.com/FallenstarOwO/deepseek-for-copilot) and not affiliated with or endorsed by the original author. The provider implementation, i18n scaffolding, and most of the architecture come from upstream, with the MIT license and copyright notice preserved in [LICENSE](LICENSE) and shipped with every build. This fork adds web search/fetch tools, OCR, the balance panel and status bar, plus stream error handling and credential-boundary hardening.

> **Uninstall the original extension first.** Both extensions register the same `deepseek` model vendor, and having both installed causes duplicate command IDs that prevent this extension from activating.

[MIT](LICENSE)
