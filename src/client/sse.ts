import { escapeControlCharactersInStrings } from '../json';
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
	onToolCall(call: DeepSeekToolCall, finishReason: string | undefined): void;
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
	// Head of a frame split by a raw newline inside a JSON string; spliced back
	// together on the next physical line instead of dropping the delta.
	let pendingPayload: string | undefined;

	const processChunk = (chunk: StreamChunk): StreamFinishOutcome | undefined => {
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
			return undefined;
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

		return undefined;
	};

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

		for (const physicalLine of lines) {
			// Keep the physical line intact for splicing: a raw newline inside a
			// JSON string is payload content, so indentation and empty lines must
			// survive. Only the SSE CR is dropped.
			const line = physicalLine.endsWith('\r') ? physicalLine.slice(0, -1) : physicalLine;
			const trimmed = line.trim();

			// Tolerate both `data: {...}` and the equally valid `data:{...}`.
			if (!trimmed.startsWith('data:')) {
				if (pendingPayload === undefined) {
					// Blank lines delimit events; `:` lines are keep-alive comments.
					continue;
				}
				// Rest of a frame split by a raw newline inside a JSON string.
				// Join the untrimmed line so blank lines and indentation survive.
				const joined = `${pendingPayload}\n${line}`;
				const joinedChunk = parseChunk(joined);
				if (joinedChunk === undefined) {
					pendingPayload = retainPendingPayload(joined);
					continue;
				}
				pendingPayload = undefined;
				const joinedOutcome = processChunk(joinedChunk);
				if (joinedOutcome) {
					return joinedOutcome;
				}
				continue;
			}

			// Do not trim the tail: trailing spaces on a head line can be payload
			// characters when the string continues on the next physical line.
			const payload = line.trimStart().slice('data:'.length);
			const trimmedPayload = payload.trim();

			if (trimmedPayload === '[DONE]') {
				if (latestUsage) {
					handlers.onUsage(latestUsage);
				}
				return finishFromSnapshot(lastFinishReason, pendingToolCalls, handlers);
			}

			if (!trimmedPayload) {
				continue;
			}

			// A new frame supersedes a half-open one; the earlier head was unusable.
			pendingPayload = undefined;

			const chunk = parseChunk(payload);
			if (chunk === undefined) {
				pendingPayload = retainPendingPayload(payload);
				continue;
			}

			const outcome = processChunk(chunk);
			if (outcome) {
				return outcome;
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

/** Upper bound for a frame kept open across lines; larger text is treated as garbage. */
const MAX_PENDING_PAYLOAD_CHARS = 64 * 1024;

function parseChunk(payload: string): StreamChunk | undefined {
	try {
		return JSON.parse(payload) as StreamChunk;
	} catch (error) {
		if (!(error instanceof SyntaxError)) {
			throw error;
		}
		// Tolerate unparsable lines instead of killing the stream. A frame that
		// carries a raw control character inside a string is recovered by
		// escaping it, which is lossless.
		const repaired = escapeControlCharactersInStrings(payload);
		if (repaired !== payload) {
			try {
				return JSON.parse(repaired) as StreamChunk;
			} catch {
				return undefined;
			}
		}
		return undefined;
	}
}

/**
 * Keep a JSON-looking payload that failed to parse so a following physical line
 * can be spliced in. Parseability, not the trailing character, decides whether
 * the frame is complete: a raw newline inside a string may split the frame right
 * after a `}`.
 */
function retainPendingPayload(payload: string): string | undefined {
	const trimmed = payload.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_PENDING_PAYLOAD_CHARS) {
		return undefined;
	}
	// A frame split by a raw newline inside a string can end with any character,
	// including `}` or `]` — tool arguments often embed JSON whose closing braces
	// land right at the split. Judge only by the opening delimiter; the next
	// physical line is spliced in and the raw control character is escaped again
	// by parseChunk().
	const first = trimmed[0];
	return first === '{' || first === '[' ? payload : undefined;
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
		handlers.onToolCall(tc, finishReason);
	}
	pendingToolCalls.clear();
	return { kind: 'done', finishReason };
}
