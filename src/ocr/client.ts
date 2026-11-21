import type { CancellationToken } from 'vscode';
import { getNetworkErrorCauseInfo, getNetworkErrorCode } from '../client/error/network';
import { buildToolEndpoint } from '../endpoint';
import { t } from '../i18n';
import type { WebToolsApiErrorBody } from '../search/types';
import { WebToolsError } from '../search/types';
import type { OcrFile, OcrPage, OcrPurpose, OcrResponse } from './types';

/** Total time limit (upload + recognition) documented by the OCR API. */
export const OCR_TIMEOUT_MS = 180_000;

const SERVER_MESSAGE_MAX_CHARS = 200;

/**
 * Recognize text in a document or image with the official DeepSeek OCR API.
 *
 * Billed per recognized page; failed or timed-out recognitions are not billed.
 */
export async function runOcr(options: {
	apiKey: string;
	baseUrl: string;
	file: OcrFile;
	purpose: OcrPurpose;
	token?: CancellationToken;
}): Promise<OcrResponse> {
	const controller = new AbortController();
	if (options.token?.isCancellationRequested) {
		controller.abort();
	}
	const cancelListener = options.token?.onCancellationRequested(() => controller.abort());
	let timeoutReached = false;
	const timer = setTimeout(() => {
		timeoutReached = true;
		controller.abort();
	}, OCR_TIMEOUT_MS);

	try {
		// Let fetch set the multipart Content-Type with its boundary.
		const form = new FormData();
		form.append('purpose', options.purpose);
		form.append('file', new Blob([toExactArrayBuffer(options.file.data)]), options.file.fileName);

		const response = await fetch(buildToolEndpoint(options.baseUrl, 'ocr'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${options.apiKey}`,
			},
			body: form,
			signal: controller.signal,
			// Never follow redirects: the file body must only reach the endpoint
			// the user saw in the confirmation prompt.
			redirect: 'error',
		});

		if (!response.ok) {
			throw await createOcrHttpError(response);
		}

		// The server keeps the connection alive with newline whitespace; the
		// whole body parses as JSON once recognition finishes. A 200 body can
		// still be an error object when recognition itself failed (not billed).
		const bodyText = await response.text();
		let data: unknown;
		try {
			data = JSON.parse(bodyText);
		} catch {
			throw new WebToolsError('invalid-response', t('tools.error.ocr.invalidResponse'));
		}
		const serverError = extractServerErrorMessage(data);
		if (serverError !== undefined) {
			throw new WebToolsError('http', t('tools.error.ocr.recognitionFailed', serverError));
		}
		if (!isValidOcrResponse(data)) {
			throw new WebToolsError('invalid-response', t('tools.error.ocr.invalidResponse'));
		}
		return data;
	} catch (error) {
		throw normalizeOcrError(error, timeoutReached, options.token);
	} finally {
		clearTimeout(timer);
		cancelListener?.dispose();
	}
}

function toExactArrayBuffer(view: Uint8Array): ArrayBuffer {
	// Blob requires a strict ArrayBuffer; copy only when the view is not exact.
	if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
		return view.buffer as ArrayBuffer;
	}
	return view.slice().buffer as ArrayBuffer;
}

function isValidOcrResponse(data: unknown): data is OcrResponse {
	if (typeof data !== 'object' || data === null) {
		return false;
	}
	const pages = (data as Record<string, unknown>)['pages'];
	return (
		Array.isArray(pages) &&
		pages.every(
			(page) =>
				typeof page === 'object' && page !== null && typeof (page as OcrPage).text === 'string',
		)
	);
}

function extractServerErrorMessage(data: unknown): string | undefined {
	if (typeof data !== 'object' || data === null) {
		return undefined;
	}
	const error = (data as WebToolsApiErrorBody)['error'];
	const message = typeof error === 'object' && error !== null ? error['message'] : undefined;
	if (typeof message !== 'string' || message.trim().length === 0) {
		return undefined;
	}
	const singleLine = message.replace(/\s+/gu, ' ').trim();
	return singleLine.length > SERVER_MESSAGE_MAX_CHARS
		? `${singleLine.slice(0, SERVER_MESSAGE_MAX_CHARS)}...`
		: singleLine;
}

async function createOcrHttpError(response: Response): Promise<WebToolsError> {
	const status = response.status;
	const serverMessage = await readServerErrorMessage(response);
	const key = getOcrHttpErrorMessageKey(status);
	const message = serverMessage ? `${t(key, status)} (${serverMessage})` : t(key, status);
	return new WebToolsError('http', message, status);
}

function getOcrHttpErrorMessageKey(status: number): string {
	switch (status) {
		case 400:
			return 'tools.error.ocr.http.400';
		case 402:
			return 'tools.error.http.402';
		case 408:
			return 'tools.error.ocr.http.408';
		case 413:
			return 'tools.error.ocr.http.413';
		case 429:
			return 'tools.error.ocr.http.429';
		case 504:
			return 'tools.error.ocr.http.504';
		default:
			return status >= 500 ? 'tools.error.http.5xx' : 'tools.error.http.generic';
	}
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
		const data = JSON.parse(text) as WebToolsApiErrorBody;
		const message = data.error?.message;
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

function normalizeOcrError(
	error: unknown,
	timeoutReached: boolean,
	token: CancellationToken | undefined,
): WebToolsError {
	if (error instanceof WebToolsError) {
		return error;
	}
	if (timeoutReached) {
		return new WebToolsError(
			'timeout',
			t('tools.error.ocr.timeout', Math.round(OCR_TIMEOUT_MS / 1000)),
		);
	}
	if (token?.isCancellationRequested) {
		return new WebToolsError('cancelled', t('tools.error.cancelled'));
	}
	if (error instanceof Error && error.name === 'AbortError') {
		return new WebToolsError('cancelled', t('tools.error.cancelled'));
	}
	if (error instanceof TypeError) {
		const info = getNetworkErrorCauseInfo(error);
		const code = getNetworkErrorCode(info);
		return new WebToolsError('network', t('tools.error.network.generic', code ?? 'UNKNOWN'));
	}
	const message = error instanceof Error && error.message ? error.message : String(error);
	return new WebToolsError('unknown', t('tools.error.unknown', message));
}
