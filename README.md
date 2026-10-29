<h1 align="center">DeepSeek for Copilot</h1>

<p align="center">
  <!-- marketplace-readme:remove-start -->
  <a href="https://marketplace.visualstudio.com/items?itemName=fallenstarowo.deepseek-for-copilot"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white&style=for-the-badge" alt="Install from VS Code Marketplace"></a>
  <a href="https://open-vsx.org/extension/fallenstarowo/deepseek-for-copilot"><img src="https://img.shields.io/badge/Open%20VSX-Install-6A4FB6?style=for-the-badge" alt="Install from Open VSX"></a>
  <br/>
  <!-- marketplace-readme:remove-end -->
  <img src="https://img.shields.io/github/v/release/FallenstarOwO/deepseek-for-copilot?style=for-the-badge&label=Version" alt="Version" />
  <img src="https://vsmarketplacebadges.dev/installs-short/fallenstarowo.deepseek-for-copilot.svg?style=for-the-badge" alt="Installs" />
</p>

<p align="center">
  English |
  <a href="https://github.com/FallenstarOwO/deepseek-for-copilot/blob/main/README.zh-cn.md">简体中文</a>
</p>

**Pick DeepSeek V4 from the Copilot Chat model picker — and keep everything else Copilot already gives you.**

> **Unofficial community fork.** Published by `fallenstarowo` from [FallenstarOwO/deepseek-for-copilot](https://github.com/FallenstarOwO/deepseek-for-copilot). Not affiliated with or endorsed by the original author of [Vizards/deepseek-v4-for-copilot](https://github.com/Vizards/deepseek-v4-for-copilot); the MIT license and original copyright notices are retained. Both extensions register the same `deepseek` model vendor, so **uninstall the official extension before installing this one**.

<p align="center">
  <img src="resources/screenshots/01-picker.png" alt="DeepSeek V4.1 Flash and Pro in the Copilot Chat model picker, alongside the Thinking Effort menu" width="800">
</p>

Love DeepSeek's price-performance but don't want to give up GitHub Copilot's agent mode, tool calling, and polished UI? This extension adds **DeepSeek V4.1 Flash and other DeepSeek models** to the Copilot Chat model selector — with **native vision or Vision Proxy**, **thinking mode**, and your own API key.

## Why this extension?

- **Don't replace Copilot — power it up.** No new sidebar, no new chat UI to learn. Just a new model in the picker you already use.
- **Agent mode, tool calling, instructions, MCP, skills — all of it still works.** Copilot's entire stack, now running on DeepSeek.
- **Two ways to work with images.** V4.1 Flash receives image attachments natively. V4 Pro keeps its existing text context while a configurable Vision Proxy turns images into descriptions.
- **BYOK, pay DeepSeek directly.** Your API key, your bill, your rate limits. Stored in the OS keychain, never on disk.

## Features

### DeepSeek models in the model picker
The picker includes V4.1 Flash and V4 Pro, with long context, tool calling, and configurable thinking effort.

### Native Vision and Vision Proxy
Choose the image path that fits the conversation:

- **DeepSeek V4.1 Flash** handles image attachments natively, without Vision Proxy.
- The **DeepSeek V4 Pro** entry uses Vision Proxy: an image-capable model first describes each attachment, then the main DeepSeek model receives the description with the conversation. Auto mode selects V4.1 Flash when available, while an explicitly configured VS Code model or API endpoint remains supported.

[Context caching](https://api-docs.deepseek.com/guides/kv_cache/) requires a full match with a cached prefix.

<p align="center">
  <img src="resources/screenshots/03-vision.png" alt="Dropping an image into Copilot Chat and DeepSeek responding to it via the vision proxy" width="800">
</p>

### Thinking Mode and Effort Control
Supports DeepSeek's thinking mode and `reasoning_content`. `none` disables thinking mode; `low`, `high` (default), and `max` set the thinking effort.

### Inherits Every Copilot Capability
Because this plugs into Copilot's native provider API, you get the full stack for free:
- **Agent mode** — autonomous multi-step tasks
- **Tool calling** — file edits, terminal, workspace search, Git, tests
- **Instructions & skills** — all your `.instructions.md`, `AGENTS.md`, and skills just work
- **Prompt caching stats** — DeepSeek's cache hit rate logged in the output channel so you can see the savings

<p align="center">
  <img src="resources/screenshots/04-agent.png" alt="DeepSeek V4 Pro running Copilot's agent mode with tool calls" width="800">
</p>

### Web Search and Fetch
Two built-in tools plug Copilot Chat into the official [DeepSeek Search and Fetch APIs](https://api-docs.deepseek.com/guides/search):

- **`deepseek_web_search`** — ranked web results with title, URL, date, site name, summary, and more. Inline reference: `#deepseekSearch`.
- **`deepseek_web_fetch`** — fetches one page and returns clean Markdown. Inline reference: `#deepseekFetch`.

In agent mode the model calls them automatically when a task needs fresh web information. You can also add them via the chat tools picker, or mention `#deepseekSearch` / `#deepseekFetch` explicitly. Both APIs bill per successful request — see the [official docs](https://api-docs.deepseek.com/guides/search) and the [pricing page](https://api-docs.deepseek.com/quick_start/pricing) for current rates.

Notes:
- Each tool can be disabled independently in Settings (search for `webTools`; keys: `webTools.search.enabled` / `webTools.fetch.enabled`). Disabled tools are hidden from Copilot Chat and cannot be called.
- When `deepseek-copilot.baseUrl` is customized, the target service must implement `POST /v1/tools/search` and `POST /v1/tools/fetch`.
- These standalone tools work with every DeepSeek model in this extension. The Responses API's built-in `web_search` tool is only available on `deepseek-v4-pro` and requires switching the whole chat protocol to `/responses`, which this extension does not do.
- The tools always use your configured DeepSeek API key, even when another chat model is selected.

### Secure by Default
API key lives in VS Code's `SecretStorage` (OS keychain on macOS / Windows / Linux). Never in `settings.json`, never in your Git history.

### Zero Runtime Dependencies
Pure VS Code API + Node.js built-ins. No Python, no Docker, no local proxy server to babysit.

## Getting Started

### Prerequisites

- VS Code 1.116 or later. This extension relies on non-public Copilot Chat APIs that may break on newer VS Code versions — [report an issue](https://github.com/FallenstarOwO/deepseek-for-copilot/issues) if you hit one.
- GitHub Copilot subscription (Free / Pro / Enterprise — the free tier works)
- DeepSeek API key from [platform.deepseek.com](https://platform.deepseek.com), or a compatible provider token when using a custom `deepseek-copilot.baseUrl`

### Installation

Install from the registry used by your editor:

1. **Microsoft VS Code** — install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=fallenstarowo.deepseek-for-copilot).
2. **Editors that use Open VSX** — install from [Open VSX](https://open-vsx.org/extension/fallenstarowo/deepseek-for-copilot).

### Usage

1. Run **DeepSeek: Set API Key** from the Command Palette (`Cmd+Shift+P`)
2. Paste your key or compatible provider token (official DeepSeek keys usually start with `sk-`)
3. Open Copilot Chat, click the model picker, and choose **DeepSeek V4.1 Flash** or **DeepSeek V4 Pro**
4. That's it — chat away

## Models

| Model Entry | Image Handling | Thinking Effort | Official API Status |
|---|---|---|---|
| **DeepSeek V4.1 Flash** | Native image input | `none` / `low` / `high` / `max` | Available via `deepseek-flash` |
| **DeepSeek V4 Pro** | Vision Proxy | `none` / `low` / `high` / `max` | API services continue; billing method unchanged |

Both entries support thinking mode, tool calling, and 1M token context. See the official [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) documentation for billing details.

## Settings

| Setting | Default | Description |
|---|---|---|
| `deepseek-copilot.baseUrl` | `https://api.deepseek.com` | API endpoint — change for self-hosted / proxied deployments |
| `deepseek-copilot.requestHeaders` | `{}` | Custom headers for chat completions. [Configuration guide](https://github.com/Vizards/deepseek-v4-for-copilot/blob/main/docs/settings/request-headers.en.md) |
| `deepseek-copilot.maxTokens` | `0` | Max output tokens (`0` = API default). Useful for cost control |
| `deepseek-copilot.modelIdOverrides` | prefilled official ID map | API model IDs to send for each DeepSeek model entry. Change only for compatible third-party APIs with different model names |
| `deepseek-copilot.debugMode` | `minimal` | Diagnostic mode: `minimal` for token usage only, `metadata` for privacy-preserving logs, or `verbose` for full request dumps and pipeline snapshots under extension global storage. Full dumps may include sensitive prompt text, tool schemas, file snippets, and image descriptions. Use `DeepSeek: Open Request Dumps Folder` to open the dump location |
| `deepseek-copilot.visionModel` | *(auto)* | Vision Proxy used by V4 Pro. Auto mode selects V4.1 Flash when available; configure another VS Code model or API endpoint with `DeepSeek: Configure Vision Proxy` |
| `deepseek-copilot.visionPrompt` | *(built-in)* | Prompt used by V4 Pro's Vision Proxy to describe image attachments. It does not affect native V4.1 Flash requests |
| `deepseek-copilot.experimental.stabilizeToolList` | `false` | Experimental. Tries to pre-activate VS Code/Copilot virtual tools so the DeepSeek API `tools` parameter is more complete and stable across turns. May improve context-cache hit rate when enabled tools change between turns. Can increase input tokens because more function definitions may be included; cache-hit input tokens are cheaper but still count toward usage. Usually leave it off with 64 or fewer enabled tools unless the tool list still changes across turns |

Thinking Effort is configured from Copilot Chat's model picker for each DeepSeek model.

Example `settings.json` override for compatible API proxies:

```json
{
  "deepseek-copilot.modelIdOverrides": {
    "deepseek-flash": "your-v4.1-flash-model-id",
    "deepseek-v4-pro": "your-pro-model-id"
  }
}
```

## Compared to alternatives

| | This extension | Local proxy (e.g. LiteLLM) | Standalone DeepSeek extensions |
|---|---|---|---|
| Works inside Copilot Chat | ✅ | ✅ | ❌ separate UI |
| Agent mode, tools, skills | ✅ | ✅ | ⚠️ reimplemented |
| Vision support | ✅ native + proxied | ❌ | ❌ |
| No extra process to run | ✅ | ❌ | ✅ |
| One-click install | ✅ | ❌ | ✅ |
| API key in OS keychain | ✅ | ❌ | ⚠️ varies |

## Acknowledgements

This project is a community fork of **[Vizards/deepseek-v4-for-copilot](https://github.com/Vizards/deepseek-v4-for-copilot)** by **Vizards**. The provider implementation, the vision pipeline, the i18n scaffolding, and most of the architecture come from that project — this fork would not exist without it. The upstream work is MIT licensed, and its copyright notice is preserved in [LICENSE](LICENSE) and shipped with every build.

Thanks also to the upstream contributors and everyone who reported issues or sent pull requests there; the features in this fork build directly on that groundwork.

This fork adds DeepSeek web search and web fetch tools, and publishes independently so those changes stay available while they are under review upstream.

## License

[MIT](LICENSE)
