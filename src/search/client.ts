import type { CancellationToken } from 'vscode';
import {
	getNetworkErrorCategory,
	getNetworkErrorCauseInfo,
	getNetworkErrorCode,
} from '../client/error/network';
import { isOfficialDeepSeekBaseUrl, normalizeBaseUrl } from '../endpoint';
import { t } from '../i18n';
import type {
	WebFetchInput,
	WebFetchResponse,
	WebSearchInput,
	WebSearchResponse,
	WebToolsApiErrorBody,
} from './types';
import { WebToolsError } from './types';

export const SEARCH_TIMEOUT_MS = 30_000;
export const FETCH_TIMEOUT_MS = 60_000;

const SERVER_MESSAGE_MAX_CHARS = 300;

/**
 * Build the official tool endpoint for a given base URL.
 *
 * The official host also serves `/beta` (beta features) and `/v1` (OpenAI
 * compatibility); the tools API always lives under `/v1`, so the path segment
 * of an official base URL must be ignored instead of prefixed.
 *
 * @internal Exported for tests.
 */
export function buildToolEndpoint(baseUrl: string, toolPath: 'search' | 'fetch'): string {
	const normalized = normalizeBaseUrl(baseUrl);
	if (isOfficialDeepSeekBaseUrl(normalized)) {
		return `${new URL(normalized).origin}/v1/tools/${toolPath}`;
	}
	let base = normalized;
	if (base.toLowerCase().endsWith('/v1')) {
		// Re-trim trailing slashes after stripping `/v1` so `https://x//v1` does not yield `https://x//v1/...`.
		base = normalizeBaseUrl(base.slice(0, -3));
	}
	return `${base}/v1/tools/${toolPath}`;
}

/** @internal Exported for tests. */
export async function postToolEndpoint<TData>(
	endpoint: string,
	tool: 'search' | 'fetch',
	body: unknown,
	apiKey: string,
	timeoutMs: number,
	token: CancellationToken | undefined,
): Promise<TData> {
	const controller = new AbortController();
	if (token?.isCancellationRequested) {
		controller.abort();
	}
	const cancelListener = token?.onCancellationRequested(() => controller.abort());
	let timeoutReached = false;
	const timer = setTimeout(() => {
		timeoutReached = true;
		controller.abort();
	}, timeoutMs);

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (!response.ok) {
			throw await createHttpToolError(response, tool);
		}
		return (await response.json()) as TData;
	} catch (error) {
		throw normalizeToolError(error, timeoutReached, timeoutMs, token);
	} finally {
		clearTimeout(timer);
		cancelListener?.dispose();
	}
}

async function createHttpToolError(
	response: Response,
	tool: 'search' | 'fetch',
): Promise<WebToolsError> {
	const serverMessage = await readServerErrorMessage(response);
	const key = getHttpErrorMessageKey(response.status, tool);
	const message = serverMessage
		? `${t(key, response.status)} (${serverMessage})`
		: t(key, response.status);
	return new WebToolsError('http', message, response.status);
}

async function readServerErrorMessage(response: Response): Promise<string | undefined> {
	let text: string;
	try {
		text = await response.text();
	} catch {
		return undefined;
	}
	if (!text) {
		return undefined;
	}
	try {
		const body = JSON.parse(text) as WebToolsApiErrorBody;
		const message = body.error?.message;
		if (typeof message !== 'string' || message.trim().length === 0) {
			return undefined;
		}
		const singleLine = message.replace(/\s+/gu, ' ').trim();
		return singleLine.length > SERVER_MESSAGE_MAX_CHARS
			? `${singleLine.slice(0, SERVER_MESSAGE_MAX_CHARS)}...`
			: singleLine;
	} catch {
		return undefined;
	}
}

function getHttpErrorMessageKey(status: number, tool: 'search' | 'fetch'): string {
	if (tool === 'fetch' && status === 403) {
		return 'tools.error.http.fetch.403';
	}
	if (tool === 'fetch' && status === 404) {
		return 'tools.error.http.fetch.404';
	}
	switch (status) {
		case 400:
		case 401:
		case 402:
		case 403:
		case 404:
		case 408:
		case 413:
		case 429:
			return `tools.error.http.${status}`;
		default:
			return status >= 500 ? 'tools.error.http.5xx' : 'tools.error.http.generic';
	}
}

function normalizeToolError(
	error: unknown,
	timeoutReached: boolean,
	timeoutMs: number,
	token: CancellationToken | undefined,
): WebToolsError {
	if (error instanceof WebToolsError) {
		return error;
	}
	if (timeoutReached) {
		return new WebToolsError('timeout', t('tools.error.timeout', Math.round(timeoutMs / 1000)));
	}
	if (token?.isCancellationRequested) {
		return new WebToolsError('cancelled', t('tools.error.cancelled'));
	}
	if (error instanceof Error && error.name === 'AbortError') {
		return new WebToolsError('cancelled', t('tools.error.cancelled'));
	}
	if (error instanceof SyntaxError) {
		return new WebToolsError('invalid-response', t('tools.error.invalidResponse'));
	}
	if (error instanceof TypeError) {
		const info = getNetworkErrorCauseInfo(error);
		const code = getNetworkErrorCode(info);
		const key = getNetworkMessageKey(getNetworkErrorCategory(code));
		return new WebToolsError('network', t(key, code ?? 'UNKNOWN'));
	}
	const message = error instanceof Error && error.message ? error.message : String(error);
	return new WebToolsError('unknown', t('tools.error.unknown', message));
}

function getNetworkMessageKey(category: ReturnType<typeof getNetworkErrorCategory>): string {
	switch (category) {
		case 'dns':
			return 'tools.error.network.dns';
		case 'unreachable':
			return 'tools.error.network.unreachable';
		case 'interrupted':
			return 'tools.error.network.interrupted';
		case 'timeout':
			return 'tools.error.network.timeout';
		case 'tls':
			return 'tools.error.network.tls';
		case 'aborted':
		case 'protocol':
		case 'configuration':
		case 'generic':
			return 'tools.error.network.generic';
	}
}

/**
 * Search the web with the official DeepSeek Search API.
 */
export async function searchWeb(options: {
	apiKey: string;
	baseUrl: string;
	request: WebSearchInput;
	token?: CancellationToken;
}): Promise<WebSearchResponse> {
	const endpoint = buildToolEndpoint(options.baseUrl, 'search');
	const data = await postToolEndpoint<unknown>(
		endpoint,
		'search',
		options.request,
		options.apiKey,
		SEARCH_TIMEOUT_MS,
		options.token,
	);
	if (
		typeof data !== 'object' ||
		data === null ||
		!Array.isArray((data as WebSearchResponse).results)
	) {
		throw new WebToolsError('invalid-response', t('tools.error.invalidResponse'));
	}
	return data as WebSearchResponse;
}

/**
 * Fetch a single web page with the official DeepSeek Fetch API.
 */
export async function fetchWebPage(options: {
	apiKey: string;
	baseUrl: string;
	request: WebFetchInput;
	token?: CancellationToken;
}): Promise<WebFetchResponse> {
	const endpoint = buildToolEndpoint(options.baseUrl, 'fetch');
	const data = await postToolEndpoint<unknown>(
		endpoint,
		'fetch',
		options.request,
		options.apiKey,
		FETCH_TIMEOUT_MS,
		options.token,
	);
	if (
		typeof data !== 'object' ||
		data === null ||
		typeof (data as WebFetchResponse).title !== 'string' ||
		typeof (data as WebFetchResponse).content !== 'string'
	) {
		throw new WebToolsError('invalid-response', t('tools.error.invalidResponse'));
	}
	return data as WebFetchResponse;
}
