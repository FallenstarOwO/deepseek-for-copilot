import type { DeepSeekStreamChunk, DeepSeekToolCall, DeepSeekUsage } from '../types';

/**
 * How a parsed SSE stream ended. Pure data — localization happens in the
 * caller so this module stays free of VS Code runtime dependencies.
 */
export type StreamFinishOutcome =
	| { kind: 'done'; finishReason?: string }
	| { kind: 'truncated'; finishReason: 'length' }
	| { kind: 'fatal'; finishReason: string }
	| { kind: 'disconnected'; finishReason?: string }
	| { kind: 'server-error'; detail: string }
	| { kind: 'cancelled' };

export interface SseHandlers {
	onContent(text: string): void;
	onThinking(text: string): void;
	onToolCall(call: DeepSeekToolCall): void;
	onUsage(usage: DeepSeekUsage): void;
	/** Called for every received chunk; the caller uses it to reset its idle timer. */
	onData(): void;
	isCancelled(): boolean;
}

type StreamChunk = DeepSeekStreamChunk & {
	error?: { message?: string };
};

/** Finish reasons that make the whole response unusable. */
const FATAL_FINISH_REASONS = new Set(['content_filter', 'aborted', 'insufficient_system_resource']);

/**
 * Parse an SSE chat-completions stream to its end.
 *
 * Throws nothing for stream-level outcomes — every outcome (including
 * disconnected streams and in-stream error objects) is returned as data so
 * the caller decides how to surface it. Only unexpected reader failures
 * propagate as exceptions.
 */
export async function readSseResponse(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	handlers: SseHandlers,
): Promise<StreamFinishOutcome> {
	const decoder = new TextDecoder();
	let buffer = '';
	let latestUsage: DeepSeekUsage | undefined;
	let lastFinishReason: string | undefined;

	// Accumulate tool call deltas by index, then emit on finish_reason=stop/tool_calls
	const pendingToolCalls = new Map<number, DeepSeekToolCall>();

	while (true) {
		if (handlers.isCancelled()) {
			return { kind: 'cancelled' };
		}

		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		handlers.onData();

		buffer += decoder.decode(value, { stream: true });

		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();

			if (!trimmed || trimmed.startsWith(':')) {
				continue;
			}

			// Tolerate both `data: {...}` and the equally valid `data:{...}`.
			if (!trimmed.startsWith('data:')) {
				continue;
			}
			const payload = trimmed.slice('data:'.length).trimStart();

			if (payload === '[DONE]') {
				if (latestUsage) {
					handlers.onUsage(latestUsage);
				}
				return finishFromSnapshot(lastFinishReason, pendingToolCalls, handlers);
			}

			if (!payload) {
				continue;
			}

			let chunk: StreamChunk;
			try {
				chunk = JSON.parse(payload);
			} catch (e) {
				if (e instanceof SyntaxError) {
					// Tolerate unparsable lines instead of killing the stream.
					continue;
				}
				throw e;
			}

			// Some providers deliver protocol-level errors inside a 200 stream.
			const serverMessage = chunk.error?.message;
			if (typeof serverMessage === 'string' && serverMessage.length > 0) {
				return { kind: 'server-error', detail: serverMessage };
			}

			const choice = chunk.choices?.[0];

			// Some OpenAI-compatible providers emit usage on every streaming chunk.
			// Keep only the latest value and report it once when the stream completes.
			if (chunk.usage) {
				latestUsage = chunk.usage;
			}

			if (!choice) {
				continue;
			}

			if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
				lastFinishReason = choice.finish_reason;
			}

			// Thinking content → report with correct field name so VS Code renders collapsible blocks
			const reasoning = choice.delta.reasoning_content;
			if (reasoning) {
				handlers.onThinking(reasoning);
			}

			// Regular content
			if (choice.delta.content) {
				handlers.onContent(choice.delta.content);
			}

			// Tool calls — accumulate deltas by index. They are flushed only
			// once the stream is confirmed complete (see finishFromSnapshot).
			if (choice.delta.tool_calls) {
				for (const tc of choice.delta.tool_calls) {
					let pending = pendingToolCalls.get(tc.index);
					if (!pending && tc.id) {
						pending = {
							id: tc.id,
							type: 'function',
							function: { name: '', arguments: '' },
						};
						pendingToolCalls.set(tc.index, pending);
					}
					if (pending) {
						if (tc.function?.name) {
							pending.function.name += tc.function.name;
						}
						if (tc.function?.arguments) {
							pending.function.arguments += tc.function.arguments;
						}
					}
				}
			}

			// No mid-stream flush on finish_reason=stop/tool_calls: the host is
			// told about calls only once the stream is confirmed complete.
		}
	}

	// Reaching here means the stream closed without a [DONE] marker (that branch
	// returns above).
	if (lastFinishReason === undefined) {
		// No finish_reason either: the stream was cut mid-generation. Never
		// masquerade as a completed response, and do not flush pending calls.
		return { kind: 'disconnected' };
	}
	// Compatible endpoints may close right after finish_reason without [DONE];
	// a finish_reason means the choice completed, so this is a legitimate end.
	return finishFromSnapshot(lastFinishReason, pendingToolCalls, handlers);
}

/**
 * Map the observed finish state to an outcome. Tool calls are handed to the
 * host only for a healthy completion: truncated or fatal responses drop them
 * because a partial accumulation may be half a JSON payload and cannot be
 * un-reported.
 */
function finishFromSnapshot(
	finishReason: string | undefined,
	pendingToolCalls: Map<number, DeepSeekToolCall>,
	handlers: SseHandlers,
): StreamFinishOutcome {
	if (finishReason === 'length') {
		return { kind: 'truncated', finishReason: 'length' };
	}
	if (finishReason !== undefined && FATAL_FINISH_REASONS.has(finishReason)) {
		return { kind: 'fatal', finishReason };
	}
	for (const tc of pendingToolCalls.values()) {
		handlers.onToolCall(tc);
	}
	pendingToolCalls.clear();
	return { kind: 'done', finishReason };
}
