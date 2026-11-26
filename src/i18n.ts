import vscode from 'vscode';

/**
 * Lightweight i18n module — zero dependencies, follows VS Code display language.
 *
 *  - en / en-US / en-*      → English (default)
 *  - zh-cn                  → Simplified Chinese
 *  - all other locales      → English until translated
 */

function isZh(): boolean {
	const lang = vscode.env.language.toLowerCase();
	return lang === 'zh-cn';
}

// ---- Translation dictionaries ----

type Translations = Record<string, string>;

const zh: Translations = {
	// Model descriptions
	'model.deepseek-flash.detail': '图像理解与思考模式',
	'model.deepseek-flash.tooltip': 'DeepSeek V4.1 Flash，支持图片与文本输入、思考模式和工具调用。',
	'model.pro.detail': '深度推理',
	'model.pro.tooltip': 'DeepSeek V4 模型，面向 Agent 编程、广泛世界知识和高阶推理任务。',
	'model.pricing.currentPeak': '高峰时段',
	'model.pricing.currentOffPeak': '空闲时段',
	'model.pricing.inputLabel': '输入',
	'model.pricing.cacheHitInputLabel': '输入 (缓存命中)',
	'model.pricing.outputLabel': '输出',
	'model.pricing.unitSuffix': ' / 百万 tokens',
	'model.pricing.periodStarts': '{1}进入{0}',
	'model.pricing.transitionTime.today': '{0}',
	'model.pricing.transitionTime.tomorrow': '明天 {0}',
	'model.pricing.transitionTime.weekday': '{0} {1}',

	// API Key
	'auth.apiKeyRequiredDetail': '请先配置 API Key',
	'auth.prompt': '请输入 DeepSeek API Key 或兼容服务令牌。官方 DeepSeek Key 通常以 "sk-" 开头。',
	'auth.placeholder': 'sk-... 或服务商令牌',
	'auth.emptyValidation': 'API Key 不能为空',
	'auth.saved': 'API Key 已安全保存。',
	'auth.removed': 'API Key 已移除。',
	'auth.clearConfirm': '清除已保存的 API Key？',
	'auth.clearDetail': '清除后，再次使用时可能需要重新设置 API Key。',
	'auth.clearAction': '清除 API Key',
	'auth.notConfigured': '尚未配置 API Key，请先设置 API Key 后重试。',

	// Settings
	'settings.resetBaseUrl.title': '恢复 DeepSeek Base URL 默认配置',
	'settings.resetBaseUrl.chooseScope': '选择要重置的范围；仅移除该范围的自定义地址',
	'settings.resetBaseUrl.user': '用户设置',
	'settings.resetBaseUrl.workspace': '当前工作区',
	'settings.resetBaseUrl.current': '当前配置：{0}',
	'settings.resetBaseUrl.notConfigured': '未自定义，无需重置',
	'settings.resetBaseUrl.after': '重置后生效地址：{0}',
	'settings.resetBaseUrl.afterInherited': '重置后继承其余配置，实际生效地址请查看设置',
	'settings.resetBaseUrl.failed': '重置 Base URL 失败，请运行 "DeepSeek: 显示日志" 查看详情。',

	// Thinking level — labels mirror the model settings panel
	'status.thinking': '思考层级',
	'thinking.none': '无',
	'thinking.none.desc': '关闭思考，响应更快',
	'thinking.low': '低',
	'thinking.low.desc': '快速推理，适合简单任务',
	'thinking.high': '高',
	'thinking.high.desc': '推荐日常使用',
	'thinking.max': '最大值',
	'thinking.max.desc': '最强推理，适合复杂任务',

	// Request
	'request.preflightRoundLimitExceeded':
		'实验性稳定工具列表设置已尝试 {0} 轮，仍无法得到稳定的已启用工具列表。请关闭该实验性设置，或先用 VS Code 的 Configure Tools 关闭不常用的工具。',
	'notice.toolDrift':
		'⚠️ 工具列表不稳定，缓存命中率可能下降。[了解更多](https://github.com/Vizards/deepseek-v4-for-copilot/blob/main/docs/notices/tool-drift.zh.md)',

	// Errors
	'error.http.400': '[{0}] 请求体格式错误。请根据错误信息提示修改请求体。',
	'error.http.401':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如没有 API key，请先创建 API Key。',
	'error.http.401.withCreateApiKeyLink':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如没有 API key，请先[创建 API Key]({1})。',
	'error.http.402': '[{0}] 账号余额不足。请确认账户余额，并前往充值页面进行充值。',
	'error.http.422': '[{0}] 请求体参数错误。请根据错误信息提示修改相关参数。',
	'error.http.429': '[{0}] 请求速率（TPM 或 RPM）达到上限。请合理规划您的请求速率。',
	'error.http.500': '[{0}] 服务器内部故障。请等待后重试。',
	'error.http.503': '[{0}] 服务器负载过高。请稍后重试您的请求。',
	'error.http.generic': '[{0}] 服务返回错误响应。',
	'error.action.setApiKey': '设置 API Key',
	'error.action.createApiKey': '创建 API Key',
	'error.action.viewUsage': '用量',
	'error.action.checkDeepSeekStatus': 'DeepSeek 状态',
	'error.action.viewDetails': '错误详情',
	'error.network.dns': '[{0}] DNS 解析失败。请检查网络连接、防火墙或代理设置，以及自定义 baseUrl。',
	'error.network.unreachable':
		'[{0}] 目标不可达或拒绝连接。请检查自定义 baseUrl、代理服务、网络连接或防火墙设置。',
	'error.network.interrupted': '[{0}] 连接被中断。请检查网络连接、防火墙或代理设置，或稍后重试。',
	'error.network.timeout': '[{0}] 连接超时。请稍后重试，或检查网络连接、防火墙或代理设置。',
	'error.network.tls': '[{0}] TLS/证书校验失败。请检查代理、证书配置或自定义 baseUrl。',
	'error.network.aborted':
		'[{0}] 请求已中止。如果不是主动取消，请检查网络连接或代理设置，或稍后重试。',
	'error.network.protocol':
		'[{0}] HTTP 连接或响应解析失败。请检查代理设置、自定义 baseUrl 或服务响应。',
	'error.network.configuration': '[{0}] 请求配置无效。请检查自定义 baseUrl 或扩展设置。',
	'error.network.generic':
		'[{0}] 网络请求失败。请检查网络连接、防火墙或代理设置，以及自定义 baseUrl。',
	'error.unknown': 'DeepSeek 请求失败：{0}',

	// Extension
	'extension.activateFailed': 'DeepSeek 激活失败，请运行 "DeepSeek: 显示日志" 查看详情。',
	'extension.welcomeFailed': '欢迎引导加载异常',
	'extension.toolsRegisterFailed': '网页搜索/抓取工具注册失败，不影响主功能。',
	'extension.openRequestDumpsFolderFailed':
		'打开请求 dump 目录失败，请运行 "DeepSeek: 显示日志" 查看详情。',

	// Web Tools
	'tools.invocation.search': '正在搜索网页',
	'tools.invocation.fetch': '正在抓取网页',
	'tools.confirm.search.title': 'DeepSeek 网页搜索',
	'tools.confirm.search.message': '使用 DeepSeek Search API 搜索“{0}”？（按成功请求计费）',
	'tools.confirm.fetch.title': 'DeepSeek 网页抓取',
	'tools.confirm.fetch.message': '使用 DeepSeek Fetch API 抓取 {0}？（按成功请求计费）',
	'tools.error.apiKeyMissing':
		'尚未配置 DeepSeek API Key。请运行 "DeepSeek: 设置 API Key" 后重试。',
	'tools.error.searchDisabled':
		'DeepSeek 网页搜索已关闭。请在设置中启用 "deepseek-copilot.webTools.search.enabled" 后重试。',
	'tools.error.fetchDisabled':
		'DeepSeek 网页抓取已关闭。请在设置中启用 "deepseek-copilot.webTools.fetch.enabled" 后重试。',
	'tools.error.timeout': '请求超时（{0} 秒）。请稍后重试。',
	'tools.error.cancelled': '请求已取消。',
	'tools.error.invalidResponse':
		'服务返回了无法解析的响应。若使用了自定义 baseUrl，请确认目标服务支持 /v1/tools/search 与 /v1/tools/fetch。',
	'tools.error.unknown': 'DeepSeek 工具请求失败：{0}',
	'tools.error.http.400':
		'[HTTP {0}] 请求参数无效（例如 query 长度或取值范围不符合要求）。请调整参数后重试。',
	'tools.error.http.401':
		'[HTTP {0}] API Key 无效或未认证。请运行 "DeepSeek: 设置 API Key" 重新配置。',
	'tools.error.http.402': '[HTTP {0}] 账户余额不足。请前往 DeepSeek 开放平台充值后重试。',
	'tools.error.http.403': '[HTTP {0}] 无权访问该资源。请检查 API Key 权限。',
	'tools.error.http.404':
		'[HTTP {0}] 端点不存在。若使用自定义 baseUrl，目标服务需支持 /v1/tools/search 与 /v1/tools/fetch。',
	'tools.error.http.fetch.403':
		'[HTTP {0}] 抓取请求被安全策略拒绝。目标站点可能禁止访问或内容类型不受支持。',
	'tools.error.http.fetch.404':
		'[HTTP {0}] 无法获取网页内容。URL 可能不可用、被站点策略拦截、返回错误，或页面没有可提取的 Markdown 正文。',
	'tools.error.http.408': '[HTTP {0}] 请求超时。请稍后重试。',
	'tools.error.http.413': '[HTTP {0}] 请求体过大。请缩短参数后重试。',
	'tools.error.http.429':
		'[HTTP {0}] 请求过于频繁（Search 限 100 QPS，Fetch 限 25 QPS）。请降低频率后重试。',
	'tools.error.http.5xx': '[HTTP {0}] 服务端错误。请稍后重试。',
	'tools.error.http.generic': '[HTTP {0}] 服务返回错误。',
	'tools.error.network.dns': '[{0}] DNS 解析失败。请检查网络连接与自定义 baseUrl。',
	'tools.error.network.unreachable':
		'[{0}] 无法连接目标服务。请检查自定义 baseUrl、网络或代理设置。',
	'tools.error.network.interrupted': '[{0}] 连接被中断。请检查网络后重试。',
	'tools.error.network.timeout': '[{0}] 网络连接超时。请稍后重试。',
	'tools.error.network.tls': '[{0}] TLS/证书校验失败。请检查代理或证书配置。',
	'tools.error.network.generic': '[{0}] 网络请求失败。请检查网络连接与自定义 baseUrl。',
	'tools.output.search.empty': '未找到相关结果。可尝试更换或细化搜索词后重试。',
	'tools.output.truncated': '（输出已截断：保留前 {0} / 共 {1} 字符）',
	'tools.invocation.ocr': '正在识别文件文字',
	'tools.confirm.ocr.title': 'DeepSeek OCR',
	'tools.confirm.ocr.message':
		'将 "{0}" 上传到 {2} 运行 OCR（{1}）。按识别成功的页数计费，识别开始后取消不会中断识别。',
	'tools.error.ocrDisabled':
		'DeepSeek OCR 已禁用。请在设置中启用 "deepseek-copilot.ocr.enabled" 后重试。',
	'tools.error.ocr.fileNotFound': '找不到文件：{0}。请提供绝对路径，或当前工作区内的相对路径。',
	'tools.error.ocr.fileTooLarge': '文件大小 {0} MiB 超过 100 MiB 上限。',
	'tools.error.ocr.invalidResponse': '服务返回了无法解析的 OCR 响应。',
	'tools.error.ocr.recognitionFailed': 'OCR 识别失败：{0}',
	'tools.error.ocr.timeout': 'OCR 超时（{0}s）。请使用更小的文件重试。',
	'tools.error.ocr.http.400':
		'[HTTP {0}] 请求无效或文件无法处理。请确认文件格式受支持（PDF、Word、PowerPoint 或常见图片格式）。',
	'tools.error.ocr.http.408': '[HTTP {0}] 上传过慢或连接中断。请检查网络后重试。',
	'tools.error.ocr.http.413': '[HTTP {0}] 文件超过 100 MiB 上限。请压缩或拆分文件后重试。',
	'tools.error.ocr.http.429':
		'[HTTP {0}] 同时进行的识别数达到上限（15）。请等待进行中的识别完成后再试。',
	'tools.error.ocr.http.504': '[HTTP {0}] 上传与识别超过总时长上限（180s）。请使用更小的文件重试。',
	'tools.output.ocr.header': 'OCR 结果：{0} · 共 {1} 页',
	'tools.output.ocr.page': '第 {0} 页',
	'tools.output.ocr.incomplete': '（本页输出被截断）',
	'tools.output.ocr.empty': 'OCR 未返回文字内容。',

	// Balance panel
	'balance.panel.title': 'DeepSeek 余额',
	'balance.panel.loading': '正在查询余额…',
	'balance.panel.refresh': '刷新',
	'balance.panel.retry': '重试',
	'balance.panel.available': '账户可用',
	'balance.panel.unavailable': '余额不足',
	'balance.panel.total': '总余额',
	'balance.panel.granted': '赠金余额',
	'balance.panel.toppedUp': '充值余额',
	'balance.panel.updatedAt': '更新于 {0}',
	'balance.panel.viewUsage': '查看用量',
	'balance.panel.openFailed': '打开余额面板失败，请运行 "DeepSeek: 显示日志" 查看详情。',
	'balance.error.notConfigured': '尚未配置 API Key，设置后即可查询余额。',
	'balance.error.unsupported':
		'[HTTP {0}] 当前端点不支持余额查询。余额查询仅官方 DeepSeek API 提供，第三方服务通常没有 /user/balance 接口。',
	'balance.error.http.401':
		'[HTTP {0}] API Key 无效或未认证，请运行 "DeepSeek: 设置 API Key" 重新配置。',
	'balance.error.http.generic': '[HTTP {0}] 查询余额失败，服务返回错误。',
	'balance.error.timeout': '查询余额超时（{0}s），请稍后重试。',
	'balance.error.cancelled': '请求已取消。',
	'balance.error.network':
		'[{0}] 网络请求失败。请检查网络连接、防火墙或代理设置，以及自定义 baseUrl。',
	'balance.error.invalidResponse':
		'服务返回了无法解析的余额响应。若使用自定义 baseUrl，请确认其支持 GET /user/balance。',
	'balance.error.unknown': '查询余额失败：{0}',
	'balance.statusBar.name': 'DeepSeek 余额',
	'balance.statusBar.tooltip.title': 'DeepSeek 账户余额',
	'balance.statusBar.clickHint': '点击刷新',
	'balance.statusBar.registerFailed': '余额状态栏初始化失败，核心功能不受影响。',
	'endpointConfig.ignored.message':
		'检测到工作区级的 `{0}` 配置：这两项出于安全考虑只接受用户级设置，工作区值已被忽略。为避免把可能属于旧端点的 API Key 发往新端点，余额状态栏已暂停；请确认当前端点与 Key 后在用户设置中重新配置。',
	'endpointConfig.ignored.openSettings': '打开用户设置',

	// Stream integrity
	'error.stream.disconnected':
		'响应流在完成前中断（未收到结束标记），已生成的内容可能不完整。请重试。',
	'error.stream.length': '模型输出达到长度上限，回答被截断。',
	'error.stream.contentFilter': '模型输出被内容安全策略过滤，本次回答不完整。',
	'error.stream.aborted': '服务端中断了生成。请重试。',
	'error.stream.resource': '系统推理资源不足，生成被打断。请稍后重试。',
	'error.stream.idleTimeout': '响应流超时（{0}s 无数据）。请检查网络或代理设置后重试。',
	'error.stream.serverError': '服务返回错误：{0}',
	'request.invalidToolArguments':
		'模型为工具 "{0}" 返回了无效参数，已忽略本次调用以免错误执行。请重试。',
	'request.truncatedToolArguments':
		'模型为工具 "{0}" 生成的参数不完整（输出在参数中间被截断），已忽略本次调用以免错误执行。请重试；若反复出现，可在设置中调大 "deepseek-copilot.maxTokens"。',
};

const en: Translations = {
	// Model descriptions
	'model.deepseek-flash.detail': 'Vision and thinking mode',
	'model.deepseek-flash.tooltip':
		'DeepSeek V4.1 Flash with image and text input, thinking mode, and tool calling.',
	'model.pro.detail': 'Most capable reasoning model',
	'model.pro.tooltip':
		'DeepSeek V4 model for agentic coding, broad world knowledge, and high-end reasoning.',
	'model.pricing.currentPeak': 'Peak',
	'model.pricing.currentOffPeak': 'Off-peak',
	'model.pricing.inputLabel': 'Input',
	'model.pricing.cacheHitInputLabel': 'Cache Input',
	'model.pricing.outputLabel': 'Output',
	'model.pricing.unitSuffix': ' per 1M tokens',
	'model.pricing.periodStarts': '{0} starts {1}',
	'model.pricing.transitionTime.today': 'at {0}',
	'model.pricing.transitionTime.tomorrow': 'tomorrow at {0}',
	'model.pricing.transitionTime.weekday': 'on {0} at {1}',

	// API Key
	'auth.apiKeyRequiredDetail': 'Please run DeepSeek: Set API Key to configure.',
	'auth.prompt':
		'Enter your DeepSeek API key or compatible provider token. Official DeepSeek keys usually start with "sk-".',
	'auth.placeholder': 'sk-... or provider token',
	'auth.emptyValidation': 'API key cannot be empty',
	'auth.saved': 'DeepSeek API key saved.',
	'auth.removed': 'DeepSeek API key removed.',
	'auth.clearConfirm': 'Clear the saved API Key?',
	'auth.clearDetail': 'You may need to set an API Key again before using the extension.',
	'auth.clearAction': 'Clear API Key',
	'auth.notConfigured': 'DeepSeek API key is not configured. Set an API key and try again.',

	// Settings
	'settings.resetBaseUrl.title': 'Reset DeepSeek Base URL',
	'settings.resetBaseUrl.chooseScope': 'Choose a scope; only its custom URL will be removed',
	'settings.resetBaseUrl.user': 'User Settings',
	'settings.resetBaseUrl.workspace': 'Current Workspace',
	'settings.resetBaseUrl.current': 'Configured URL: {0}',
	'settings.resetBaseUrl.notConfigured': 'Not customized; no reset needed',
	'settings.resetBaseUrl.after': 'Effective URL after reset: {0}',
	'settings.resetBaseUrl.afterInherited':
		'Inherits remaining configuration after reset; check Settings for the effective URL',
	'settings.resetBaseUrl.failed':
		'Failed to reset Base URL. Run "DeepSeek: Show Logs" for details.',

	// Thinking level — labels mirror the model settings panel
	'status.thinking': 'Thinking Level',
	'thinking.none': 'None',
	'thinking.none.desc': 'Disable thinking for faster responses',
	'thinking.low': 'Low',
	'thinking.low.desc': 'Fast reasoning for simple tasks',
	'thinking.high': 'High',
	'thinking.high.desc': 'Recommended for most tasks',
	'thinking.max': 'Maximum',
	'thinking.max.desc': 'Deepest reasoning for complex tasks',

	// Request
	'request.preflightRoundLimitExceeded':
		'Experimental tool-list stabilization tried {0} rounds but still could not get a stable enabled-tools list. Turn this experimental setting off, or use VS Code Configure Tools to disable tools you rarely use first.',
	'notice.toolDrift':
		'⚠️ Tool list is unstable; cache hit rate may drop. [Learn more](https://github.com/Vizards/deepseek-v4-for-copilot/blob/main/docs/notices/tool-drift.en.md)',

	// Errors
	'error.http.400':
		'[{0}] Invalid request body format. Please modify your request body according to the hints in the error message.',
	'error.http.401':
		"[{0}] Authentication fails due to the wrong API key. Please check your API key. If you don't have one, please create an API key first.",
	'error.http.401.withCreateApiKeyLink':
		"[{0}] Authentication fails due to the wrong API key. Please check your API key. If you don't have one, please [create an API key]({1}) first.",
	'error.http.402':
		"[{0}] You have run out of balance. Please check your account's balance, and go to the Top up page to add funds.",
	'error.http.422':
		'[{0}] Your request contains invalid parameters. Please modify your request parameters according to the hints in the error message.',
	'error.http.429':
		'[{0}] You are sending requests too quickly. Please pace your requests reasonably.',
	'error.http.500':
		'[{0}] Our server encounters an issue. Please retry your request after a brief wait.',
	'error.http.503':
		'[{0}] The server is overloaded due to high traffic. Please retry your request after a brief wait.',
	'error.http.generic': '[{0}] The service returned an error response.',
	'error.action.setApiKey': 'Set API Key',
	'error.action.createApiKey': 'Create API Key',
	'error.action.viewUsage': 'Usage',
	'error.action.checkDeepSeekStatus': 'DeepSeek Status',
	'error.action.viewDetails': 'Error Details',
	'error.network.dns':
		'[{0}] DNS lookup failed. Check your network connection, firewall, or proxy settings, and your custom baseUrl.',
	'error.network.unreachable':
		'[{0}] The target is unreachable or refused the connection. Check your custom baseUrl, proxy service, network connection, or firewall settings.',
	'error.network.interrupted':
		'[{0}] The connection was interrupted. Check your network connection, firewall, or proxy settings, or try again later.',
	'error.network.timeout':
		'[{0}] Connection timed out. Try again later, or check your network connection, firewall, or proxy settings.',
	'error.network.tls':
		'[{0}] TLS/certificate verification failed. Check your proxy settings, certificate configuration, or custom baseUrl.',
	'error.network.aborted':
		'[{0}] The request was aborted. If you did not cancel it, check your network connection or proxy settings, or try again later.',
	'error.network.protocol':
		'[{0}] The HTTP connection or response parsing failed. Check your proxy settings, custom baseUrl, or service response.',
	'error.network.configuration':
		'[{0}] The request configuration is invalid. Check your custom baseUrl or extension settings.',
	'error.network.generic':
		'[{0}] Network request failed. Check your network connection, firewall, or proxy settings, and your custom baseUrl.',
	'error.unknown': 'DeepSeek request failed: {0}',

	// Extension
	'extension.activateFailed': 'DeepSeek failed to activate. Run "DeepSeek: Show Logs" for details.',
	'extension.welcomeFailed': 'Failed to show DeepSeek welcome prompt',
	'extension.toolsRegisterFailed': 'Failed to register web tools; core features are unaffected.',
	'extension.openRequestDumpsFolderFailed':
		'Failed to open request dumps folder. Run "DeepSeek: Show Logs" for details.',

	// Web Tools
	'tools.invocation.search': 'Searching the web',
	'tools.invocation.fetch': 'Fetching web page',
	'tools.confirm.search.title': 'DeepSeek web search',
	'tools.confirm.search.message':
		'Search the web for "{0}" with the DeepSeek Search API? (billed per successful request)',
	'tools.confirm.fetch.title': 'DeepSeek web fetch',
	'tools.confirm.fetch.message':
		'Fetch page content from {0} with the DeepSeek Fetch API? (billed per successful request)',
	'tools.error.apiKeyMissing':
		'DeepSeek API key is not configured. Run "DeepSeek: Set API Key" and try again.',
	'tools.error.searchDisabled':
		'DeepSeek Web Search is disabled. Enable "deepseek-copilot.webTools.search.enabled" in Settings and try again.',
	'tools.error.fetchDisabled':
		'DeepSeek Web Fetch is disabled. Enable "deepseek-copilot.webTools.fetch.enabled" in Settings and try again.',
	'tools.error.timeout': 'The request timed out ({0}s). Try again later.',
	'tools.error.cancelled': 'The request was cancelled.',
	'tools.error.invalidResponse':
		'The service returned a response that could not be parsed. With a custom baseUrl, make sure the target service supports /v1/tools/search and /v1/tools/fetch.',
	'tools.error.unknown': 'DeepSeek tool request failed: {0}',
	'tools.error.http.400':
		'[HTTP {0}] Invalid request parameters (for example, query length or value out of range). Adjust the parameters and try again.',
	'tools.error.http.401':
		'[HTTP {0}] The API key is invalid or missing. Run "DeepSeek: Set API Key" to configure it again.',
	'tools.error.http.402':
		'[HTTP {0}] Your account is out of balance. Top up on the DeepSeek platform and try again.',
	'tools.error.http.403':
		'[HTTP {0}] Access to the resource is forbidden. Check the API key permissions.',
	'tools.error.http.404':
		'[HTTP {0}] Endpoint not found. With a custom baseUrl, the target service must support /v1/tools/search and /v1/tools/fetch.',
	'tools.error.http.fetch.403':
		'[HTTP {0}] The fetch request was rejected by a security policy. The target site may block access or use an unsupported content type.',
	'tools.error.http.fetch.404':
		'[HTTP {0}] Could not fetch usable content. The URL may be unavailable, blocked by the site, return an error, or have no extractable Markdown body.',
	'tools.error.http.408': '[HTTP {0}] The request timed out. Try again later.',
	'tools.error.http.413':
		'[HTTP {0}] The request body is too large. Shorten the parameters and try again.',
	'tools.error.http.429':
		'[HTTP {0}] Too many requests (Search is limited to 100 QPS, Fetch to 25 QPS). Slow down and try again.',
	'tools.error.http.5xx': '[HTTP {0}] Server error. Try again later.',
	'tools.error.http.generic': '[HTTP {0}] The service returned an error.',
	'tools.error.network.dns':
		'[{0}] DNS lookup failed. Check your network connection and custom baseUrl.',
	'tools.error.network.unreachable':
		'[{0}] The target is unreachable. Check your custom baseUrl, network, or proxy settings.',
	'tools.error.network.interrupted':
		'[{0}] The connection was interrupted. Check your network and try again.',
	'tools.error.network.timeout': '[{0}] The network connection timed out. Try again later.',
	'tools.error.network.tls':
		'[{0}] TLS/certificate verification failed. Check your proxy or certificate configuration.',
	'tools.error.network.generic':
		'[{0}] Network request failed. Check your network connection and custom baseUrl.',
	'tools.output.search.empty': 'No results found. Try a different or more specific query.',
	'tools.output.truncated': '(Output truncated: kept the first {0} of {1} characters)',
	'tools.invocation.ocr': 'Recognizing text in file',
	'tools.confirm.ocr.title': 'DeepSeek OCR',
	'tools.confirm.ocr.message':
		'Upload "{0}" to {2} for OCR ({1})? Billed per recognized page; cancellation does not stop a started recognition.',
	'tools.error.ocrDisabled':
		'DeepSeek OCR is disabled. Enable "deepseek-copilot.ocr.enabled" in Settings and try again.',
	'tools.error.ocr.fileNotFound':
		'File not found: {0}. Provide an absolute path or a path relative to the current workspace.',
	'tools.error.ocr.fileTooLarge': 'The file is {0} MiB, exceeding the 100 MiB limit.',
	'tools.error.ocr.invalidResponse': 'The service returned an unparseable OCR response.',
	'tools.error.ocr.recognitionFailed': 'OCR recognition failed: {0}',
	'tools.error.ocr.timeout': 'OCR timed out ({0}s). Try again with a smaller file.',
	'tools.error.ocr.http.400':
		'[HTTP {0}] Invalid request or unprocessable file. Make sure the file format is supported (PDF, Word, PowerPoint, or common image formats).',
	'tools.error.ocr.http.408':
		'[HTTP {0}] The upload was too slow or the connection stalled. Check your network and try again.',
	'tools.error.ocr.http.413':
		'[HTTP {0}] The file exceeds the 100 MiB limit. Compress or split it and try again.',
	'tools.error.ocr.http.429':
		'[HTTP {0}] The concurrent recognition limit (15) is reached. Wait for running recognitions to finish and try again.',
	'tools.error.ocr.http.504':
		'[HTTP {0}] Upload and recognition exceeded the total time limit (180s). Try a smaller file.',
	'tools.output.ocr.header': 'OCR result for {0} ({1} pages)',
	'tools.output.ocr.page': 'Page {0}',
	'tools.output.ocr.incomplete': '(this page is incomplete)',
	'tools.output.ocr.empty': 'The OCR returned no text content.',

	// Balance panel
	'balance.panel.title': 'DeepSeek Balance',
	'balance.panel.loading': 'Fetching balance…',
	'balance.panel.refresh': 'Refresh',
	'balance.panel.retry': 'Retry',
	'balance.panel.available': 'Available',
	'balance.panel.unavailable': 'Insufficient balance',
	'balance.panel.total': 'Total balance',
	'balance.panel.granted': 'Granted balance',
	'balance.panel.toppedUp': 'Topped-up balance',
	'balance.panel.updatedAt': 'Updated {0}',
	'balance.panel.viewUsage': 'View Usage',
	'balance.panel.openFailed':
		'Failed to open the balance panel. Run "DeepSeek: Show Logs" for details.',
	'balance.error.notConfigured': 'API key is not configured. Set an API key to check your balance.',
	'balance.error.unsupported':
		'[HTTP {0}] The current endpoint does not provide a balance API. Balance lookup is only available on the official DeepSeek API; third-party services usually do not implement /user/balance.',
	'balance.error.http.401':
		'[HTTP {0}] The API key is invalid or unauthorized. Run "DeepSeek: Set API Key" to configure it again.',
	'balance.error.http.generic':
		'[HTTP {0}] Failed to query balance; the service returned an error.',
	'balance.error.timeout': 'The balance request timed out ({0}s). Try again later.',
	'balance.error.cancelled': 'The request was cancelled.',
	'balance.error.network':
		'[{0}] Network request failed. Check your network connection, firewall, or proxy settings, and your custom baseUrl.',
	'balance.error.invalidResponse':
		'The service returned an unparseable balance response. With a custom baseUrl, make sure it supports GET /user/balance.',
	'balance.error.unknown': 'Failed to query balance: {0}',
	'balance.statusBar.name': 'DeepSeek Balance',
	'balance.statusBar.tooltip.title': 'DeepSeek account balance',
	'balance.statusBar.clickHint': 'Click to refresh',
	'balance.statusBar.registerFailed':
		'Failed to initialize the balance status bar; core features are unaffected.',
	'endpointConfig.ignored.message':
		'Workspace-level `{0}` settings were found but ignored: both options are user-scope only for security. The balance status bar is paused so an API key issued for the previous endpoint is not sent to a new one automatically. Confirm the endpoint and key in your user settings.',
	'endpointConfig.ignored.openSettings': 'Open User Settings',

	// Stream integrity
	'error.stream.disconnected':
		'The response stream was interrupted before completion (no end marker); the generated content may be incomplete. Please retry.',
	'error.stream.length': 'The model output reached the length limit; the response was truncated.',
	'error.stream.contentFilter':
		'The model output was filtered by content safety policy; the response is incomplete.',
	'error.stream.aborted': 'The server aborted generation. Please retry.',
	'error.stream.resource':
		'Insufficient system resource; generation was interrupted. Please try again later.',
	'error.stream.idleTimeout':
		'The response stream timed out ({0}s without data). Check your network or proxy settings and retry.',
	'error.stream.serverError': 'The server returned an error: {0}',
	'request.invalidToolArguments':
		'The model returned invalid arguments for tool "{0}"; the call was skipped to avoid a bad invocation. Please retry.',
	'request.truncatedToolArguments':
		'The model\'s arguments for tool "{0}" were cut off mid-payload; the call was skipped to avoid a bad invocation. Retry, and increase "deepseek-copilot.maxTokens" if this keeps happening.',
};

/**
 * Resolve a translation key for the current VS Code display language.
 * Supports positional placeholders {0}, {1}, ...
 */
export function t(key: string, ...args: (string | number)[]): string {
	const dict = isZh() ? zh : en;
	let text = dict[key];
	if (text === undefined) {
		// Fall back to English when a key is missing from the active locale.
		text = en[key];
	}
	if (text === undefined) {
		return key;
	}
	// Replace all occurrences of each positional placeholder.
	for (let i = 0; i < args.length; i++) {
		text = text.replaceAll(`{${i}}`, String(args[i]));
	}
	return text;
}
