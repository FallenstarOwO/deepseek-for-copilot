import vscode from 'vscode';
import { AuthManager } from '../auth';
import { getBaseUrl, isWebFetchEnabled, isWebSearchEnabled } from '../config';
import { t } from '../i18n';
import { logger } from '../logger';
import { fetchWebPage, searchWeb } from '../search/client';
import { formatFetchResult, formatSearchResults } from '../search/format';
import type { WebFetchInput, WebSearchInput } from '../search/types';
import { WebToolsError } from '../search/types';

const CONFIRM_QUERY_MAX_CHARS = 128;
const CONFIRM_URL_MAX_CHARS = 256;

/**
 * Register the standalone DeepSeek web search and fetch tools with VS Code.
 */
export function registerLanguageModelTools(context: vscode.ExtensionContext): void {
	const auth = new AuthManager(context);

	const searchTool: vscode.LanguageModelTool<WebSearchInput> = {
		async invoke(options, token) {
			const startedAt = Date.now();
			try {
				if (!isWebSearchEnabled()) {
					throw new Error(t('tools.error.searchDisabled'));
				}
				const apiKey = await auth.getApiKey();
				if (!apiKey) {
					throw new Error(t('tools.error.apiKeyMissing'));
				}

				const baseUrl = getBaseUrl();
				logger.debug(`Web search endpoint=${baseUrl} query=${options.input.query}`);

				const response = await searchWeb({ apiKey, baseUrl, request: options.input, token });
				const text = formatSearchResults(response);
				logger.info(
					`Web search completed endpoint=${baseUrl} results=${response.results.length} chars=${text.length} elapsedMs=${Date.now() - startedAt}`,
				);
				return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
			} catch (error) {
				throw toToolError(error);
			}
		},
		prepareInvocation(options) {
			return {
				invocationMessage: t('tools.invocation.search'),
				confirmationMessages: {
					title: t('tools.confirm.search.title'),
					message: t(
						'tools.confirm.search.message',
						truncateForConfirm(options.input.query, CONFIRM_QUERY_MAX_CHARS),
					),
				},
			};
		},
	};

	const fetchTool: vscode.LanguageModelTool<WebFetchInput> = {
		async invoke(options, token) {
			const startedAt = Date.now();
			try {
				if (!isWebFetchEnabled()) {
					throw new Error(t('tools.error.fetchDisabled'));
				}
				const apiKey = await auth.getApiKey();
				if (!apiKey) {
					throw new Error(t('tools.error.apiKeyMissing'));
				}

				const baseUrl = getBaseUrl();
				logger.debug(`Web fetch endpoint=${baseUrl} url=${options.input.url}`);

				const response = await fetchWebPage({ apiKey, baseUrl, request: options.input, token });
				const text = formatFetchResult(response);
				logger.info(
					`Web fetch completed endpoint=${baseUrl} chars=${text.length} elapsedMs=${Date.now() - startedAt}`,
				);
				return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
			} catch (error) {
				throw toToolError(error);
			}
		},
		prepareInvocation(options) {
			return {
				invocationMessage: t('tools.invocation.fetch'),
				confirmationMessages: {
					title: t('tools.confirm.fetch.title'),
					message: t(
						'tools.confirm.fetch.message',
						truncateForConfirm(options.input.url, CONFIRM_URL_MAX_CHARS),
					),
				},
			};
		},
	};

	context.subscriptions.push(
		vscode.lm.registerTool('deepseek_web_search', searchTool),
		vscode.lm.registerTool('deepseek_web_fetch', fetchTool),
	);
	logger.info(
		`Registered DeepSeek web tools (deepseek_web_search, deepseek_web_fetch) search=${isWebSearchEnabled() ? 'enabled' : 'disabled'} fetch=${isWebFetchEnabled() ? 'enabled' : 'disabled'}`,
	);
}

function toToolError(error: unknown): Error {
	if (error instanceof WebToolsError && error.kind === 'cancelled') {
		return new vscode.CancellationError();
	}
	const message =
		error instanceof Error && error.message
			? error.message
			: t('tools.error.unknown', String(error));
	logger.warn(`Web tool failed: ${error instanceof Error ? error.message : String(error)}`);
	return new Error(message);
}

function truncateForConfirm(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max)}...` : value;
}
