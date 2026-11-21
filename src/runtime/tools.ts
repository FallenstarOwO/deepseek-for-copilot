import { basename } from 'path';
import vscode from 'vscode';
import { AuthManager } from '../auth';
import { getBaseUrl, isOcrEnabled, isWebFetchEnabled, isWebSearchEnabled } from '../config';
import { t } from '../i18n';
import { logger } from '../logger';
import { runOcr } from '../ocr/client';
import { formatOcrResult } from '../ocr/format';
import type { OcrInput, OcrPurpose } from '../ocr/types';
import { fetchWebPage, searchWeb } from '../search/client';
import { formatFetchResult, formatSearchResults } from '../search/format';
import type { WebFetchInput, WebSearchInput } from '../search/types';
import { WebToolsError } from '../search/types';

const CONFIRM_QUERY_MAX_CHARS = 128;
const CONFIRM_URL_MAX_CHARS = 256;
const CONFIRM_PATH_MAX_CHARS = 256;
const OCR_MAX_FILE_BYTES = 100 * 1024 * 1024;

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

	const ocrTool: vscode.LanguageModelTool<OcrInput> = {
		async invoke(options, token) {
			const startedAt = Date.now();
			try {
				if (!isOcrEnabled()) {
					throw new Error(t('tools.error.ocrDisabled'));
				}
				const apiKey = await auth.getApiKey();
				if (!apiKey) {
					throw new Error(t('tools.error.apiKeyMissing'));
				}

				const baseUrl = getBaseUrl();
				const purpose = resolveOcrPurpose(options.input.purpose);
				const { uri, data } = await readOcrFile(options.input.path);
				const fileName = basename(uri.fsPath);
				logger.debug(
					`OCR endpoint=${baseUrl} file=${fileName} bytes=${data.byteLength} purpose=${purpose}`,
				);

				const response = await runOcr({
					apiKey,
					baseUrl,
					file: { data, fileName },
					purpose,
					token,
				});
				const text = formatOcrResult(fileName, response);
				logger.info(
					`OCR completed endpoint=${baseUrl} file=${fileName} pages=${response.pages.length} chars=${text.length} elapsedMs=${Date.now() - startedAt}`,
				);
				return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
			} catch (error) {
				throw toToolError(error);
			}
		},
		prepareInvocation: async (options) => {
			// Show the resolved file and upload target without reading the whole
			// file; the full read happens only after the user approves.
			let resolvedPath = options.input.path;
			let endpoint = '';
			try {
				const uri = await statOcrFile(options.input.path);
				resolvedPath = uri.fsPath;
				endpoint = getBaseUrl();
			} catch {
				// The invoke stage reports a unified error; fall back to the raw path here.
			}
			return {
				invocationMessage: t('tools.invocation.ocr'),
				confirmationMessages: {
					title: t('tools.confirm.ocr.title'),
					message: t(
						'tools.confirm.ocr.message',
						truncateForConfirm(resolvedPath, CONFIRM_PATH_MAX_CHARS),
						resolveOcrPurpose(options.input.purpose),
						truncateForConfirm(endpoint || options.input.path, CONFIRM_URL_MAX_CHARS),
					),
				},
			};
		},
	};

	context.subscriptions.push(
		vscode.lm.registerTool('deepseek_web_search', searchTool),
		vscode.lm.registerTool('deepseek_web_fetch', fetchTool),
		vscode.lm.registerTool('deepseek_ocr', ocrTool),
	);
	logger.info(
		`Registered DeepSeek web tools (deepseek_web_search, deepseek_web_fetch, deepseek_ocr) search=${isWebSearchEnabled() ? 'enabled' : 'disabled'} fetch=${isWebFetchEnabled() ? 'enabled' : 'disabled'} ocr=${isOcrEnabled() ? 'enabled' : 'disabled'}`,
	);
}

function resolveOcrPurpose(raw: string | undefined): OcrPurpose {
	return raw === 'rich_layout_recognition' ? 'rich_layout_recognition' : 'text_recognition';
}

async function resolveFileUri(rawPath: string): Promise<vscode.Uri> {
	const isAbsolute = rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(rawPath);
	if (isAbsolute) {
		return vscode.Uri.file(rawPath);
	}
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const candidate = vscode.Uri.joinPath(folder.uri, rawPath);
		try {
			await vscode.workspace.fs.stat(candidate);
			return candidate;
		} catch {
			// Keep looking in the remaining workspace folders.
		}
	}
	throw new Error(t('tools.error.ocr.fileNotFound', rawPath));
}

/** Resolve + metadata check only — used before the user approves the upload. */
async function statOcrFile(rawPath: string): Promise<vscode.Uri> {
	const uri = await resolveFileUri(rawPath);
	let stat: vscode.FileStat;
	try {
		stat = await vscode.workspace.fs.stat(uri);
	} catch {
		throw new Error(t('tools.error.ocr.fileNotFound', rawPath));
	}
	if (stat.size > OCR_MAX_FILE_BYTES) {
		throw new Error(t('tools.error.ocr.fileTooLarge', (stat.size / (1024 * 1024)).toFixed(1)));
	}
	return uri;
}

/** Full read for the upload; re-checks existence and size after approval. */
async function readOcrFile(rawPath: string): Promise<{ uri: vscode.Uri; data: Uint8Array }> {
	const uri = await statOcrFile(rawPath);
	const data = await vscode.workspace.fs.readFile(uri);
	return { uri, data };
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
