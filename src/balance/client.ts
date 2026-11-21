import type { CancellationToken } from 'vscode';
import { getNetworkErrorCauseInfo, getNetworkErrorCode } from '../client/error/network';
import { buildAccountEndpoint } from '../endpoint';
import { t } from '../i18n';
import type { DeepSeekBalanceResponse } from './types';
import { BalanceError } from './types';

export const BALANCE_TIMEOUT_MS = 15_000;

const SERVER_MESSAGE_MAX_CHARS = 200;

/**
 * Query the DeepSeek account balance (GET /user/balance).
 */
export async function fetchBalance(options: {
	apiKey: string;
	baseUrl: string;
	headers?: Readonly<Record<string, string>>;
	token?: CancellationToken;
}): Promise<DeepSeekBalanceResponse> {
	const controller = new AbortController();
	if (options.token?.isCancellationRequested) {
		controller.abort();
	}
	const cancelListener = options.token?.onCancellationRequested(() => controller.abort());
	let timeoutReached = false;
	const timer = setTimeout(() => {
		timeoutReached = true;
		controller.abort();
	}, BALANCE_TIMEOUT_MS);

	try {
		const headers = new Headers({
			Authorization: `Bearer ${options.apiKey}`,
		});
		for (const [name, value] of Object.entries(options.headers ?? {})) {
			headers.set(name, value);
		}
		const response = await fetch(buildAccountEndpoint(options.baseUrl, '/user/balance'), {
			method: 'GET',
			headers,
			signal: controller.signal,
			// A redirect would forward the bearer token to another host.
			redirect: 'error',
		});
		if (!response.ok) {
			throw await createHttpBalanceError(response);
		}
		const data = (await response.json().catch(() => undefined)) as unknown;
		if (!isValidBalanceResponse(data)) {
			throw new BalanceError('invalid-response', t('balance.error.invalidResponse'));
		}
		return data;
	} catch (error) {
		throw normalizeBalanceError(error, timeoutReached, options.token);
	} finally {
		clearTimeout(timer);
		cancelListener?.dispose();
	}
}

function isValidBalanceResponse(data: unknown): data is DeepSeekBalanceResponse {
	if (typeof data !== 'object' || data === null) {
		return false;
	}
	const isAvailable = (data as Record<string, unknown>)['is_available'];
	const balanceInfos = (data as Record<string, unknown>)['balance_infos'];
	return typeof isAvailable === 'boolean' && Array.isArray(balanceInfos);
}

async function createHttpBalanceError(response: Response): Promise<BalanceError> {
	const status = response.status;
	const serverMessage = await readServerErrorMessage(response);
	const key =
		status === 401
			? 'balance.error.http.401'
			: status === 404 || status === 405
				? 'balance.error.unsupported'
				: 'balance.error.http.generic';
	const message = serverMessage ? `${t(key, status)} (${serverMessage})` : t(key, status);
	return new BalanceError('http', message, status);
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
		const body = JSON.parse(text) as Record<string, unknown>;
		const error = body['error'];
		const message =
			typeof error === 'object' && error !== null
				? (error as Record<string, unknown>)['message']
				: body['message'];
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

function normalizeBalanceError(
	error: unknown,
	timeoutReached: boolean,
	token: CancellationToken | undefined,
): BalanceError {
	if (error instanceof BalanceError) {
		return error;
	}
	if (timeoutReached) {
		return new BalanceError(
			'timeout',
			t('balance.error.timeout', Math.round(BALANCE_TIMEOUT_MS / 1000)),
		);
	}
	if (token?.isCancellationRequested) {
		return new BalanceError('cancelled', t('balance.error.cancelled'));
	}
	if (error instanceof Error && error.name === 'AbortError') {
		return new BalanceError('cancelled', t('balance.error.cancelled'));
	}
	if (error instanceof TypeError) {
		const info = getNetworkErrorCauseInfo(error);
		const code = getNetworkErrorCode(info);
		return new BalanceError('network', t('balance.error.network', code ?? 'UNKNOWN'));
	}
	const message = error instanceof Error && error.message ? error.message : String(error);
	return new BalanceError('unknown', t('balance.error.unknown', message));
}
