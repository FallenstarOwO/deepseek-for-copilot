import type { CancellationToken } from 'vscode';
import { t } from '../i18n';
import { safeStringify } from '../json';
import { logger } from '../logger';
import type { DeepSeekRequest, StreamCallbacks } from '../types';
import { createHttpError, formatRequestError, normalizeRequestError } from './error';
import { readSseResponse } from './sse';

/** Abort the request when no bytes arrive for this long (covers first byte too). */
const STREAM_IDLE_TIMEOUT_MS = 120_000;

/**
 * Lightweight SSE-streaming DeepSeek API client.
 * No external dependencies — uses Node's built-in fetch.
 */
export class DeepSeekClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
		private readonly requestHeaders: Readonly<Record<string, string>> = {},
	) {}

	/**
	 * Stream a chat completion from the DeepSeek API.
	 * Parses SSE chunks and dispatches callbacks for content, thinking, and tool calls.
	 */
	async streamChatCompletion(
		request: DeepSeekRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => {
			controller.abort();
		});
		if (cancellationToken?.isCancellationRequested) {
			controller.abort();
		}

		// Kill the request when the stream stalls (covers a missing first byte too).
		// Declared outside the try so the catch/finally blocks can read them.
		let idleTimedOut = false;
		let idleTimer: NodeJS.Timeout | undefined;

		try {
			// Kill the request when it stalls: the timer starts before the request
			// (covering a slow response head) and resets on every received chunk.
			const resetIdleTimer = (): void => {
				if (idleTimer !== undefined) {
					clearTimeout(idleTimer);
				}
				idleTimer = setTimeout(() => {
					idleTimedOut = true;
					controller.abort();
				}, STREAM_IDLE_TIMEOUT_MS);
			};
			resetIdleTimer();

			// Request usage stats in streaming responses so we can calibrate token counting.
			const requestBody = {
				...request,
				stream_options: { include_usage: true },
			};

			const headers = new Headers({
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			});
			for (const [name, value] of Object.entries(this.requestHeaders)) {
				headers.set(name, value);
			}

			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers,
				body: safeStringify(requestBody),
				signal: controller.signal,
				// Never follow redirects: they would resend the API key and body
				// (which may include images or attachments) to another host.
				redirect: 'error',
			});

			if (!response.ok) {
				throw await createHttpError(response, { baseUrl: this.baseUrl, request });
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			const reader = response.body.getReader();

			const outcome = await readSseResponse(reader, {
				onContent: callbacks.onContent,
				onThinking: callbacks.onThinking,
				onToolCall: callbacks.onToolCall,
				onUsage: callbacks.onUsage ?? ((): void => undefined),
				onData: resetIdleTimer,
				isCancelled: () => cancellationToken?.isCancellationRequested ?? false,
			});

			if (outcome.kind === 'cancelled') {
				return;
			}

			if (outcome.kind === 'server-error') {
				throw new Error(t('error.stream.serverError', outcome.detail));
			}
			if (outcome.kind === 'disconnected') {
				// Truncated stream: never masquerade as a completed response.
				throw new Error(t('error.stream.disconnected'));
			}
			if (outcome.kind === 'fatal') {
				const messageKey = getFatalStreamFinishReason(outcome.finishReason);
				if (messageKey) {
					callbacks.onError(new Error(t(messageKey)));
					return;
				}
			}

			if (outcome.kind === 'truncated') {
				// Truncated output is still usable; surface a warning next to the text.
				callbacks.onWarning?.(t('error.stream.length'));
			}
			callbacks.onDone();
		} catch (error) {
			if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
				return;
			}
			if (idleTimedOut) {
				const timeoutError = new Error(
					t('error.stream.idleTimeout', Math.round(STREAM_IDLE_TIMEOUT_MS / 1000)),
				);
				logger.error('DeepSeek request failed:', timeoutError.message);
				callbacks.onError(timeoutError);
				return;
			}
			const normalizedError = normalizeRequestError(error, { baseUrl: this.baseUrl, request });
			logger.error('DeepSeek request failed:', formatRequestError(normalizedError));
			callbacks.onError(normalizedError);
		} finally {
			if (idleTimer !== undefined) {
				clearTimeout(idleTimer);
			}
			cancelListener?.dispose();
		}
	}
}

/** Finish reasons that make the whole response unusable. */
function getFatalStreamFinishReason(reason: string | undefined): string | undefined {
	switch (reason) {
		case 'content_filter':
			return 'error.stream.contentFilter';
		case 'aborted':
			return 'error.stream.aborted';
		case 'insufficient_system_resource':
			return 'error.stream.resource';
		default:
			return undefined;
	}
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}
