import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSseResponse, type SseHandlers, type StreamFinishOutcome } from '../client/sse';

const ENCODER = new TextEncoder();

function sseResponseStream(lines: readonly string[]): ReadableStreamDefaultReader<Uint8Array> {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const line of lines) {
				controller.enqueue(ENCODER.encode(`${line}\n`));
			}
			controller.close();
		},
	});
	return stream.getReader();
}

function sseData(json: unknown): string {
	return `data: ${JSON.stringify(json)}`;
}

function createHandlers(overrides: Partial<SseHandlers> = {}): SseHandlers & {
	events: string[];
	dataCalls: number;
} {
	const events: string[] = [];
	let dataCalls = 0;
	return {
		events,
		get dataCalls() {
			return dataCalls;
		},
		onContent: (text) => events.push(`content:${text}`),
		onThinking: (text) => events.push(`thinking:${text}`),
		onToolCall: (call) => events.push(`tool:${call.function.name}:${call.function.arguments}`),
		onUsage: (usage) => events.push(`usage:${usage.total_tokens}`),
		onData: () => {
			dataCalls += 1;
		},
		isCancelled: () => false,
		...overrides,
	};
}

async function collect(
	lines: readonly string[],
	overrides: Partial<SseHandlers> = {},
): Promise<{ outcome: StreamFinishOutcome; events: string[]; dataCalls: number }> {
	const handlers = createHandlers(overrides);
	const outcome = await readSseResponse(sseResponseStream(lines), handlers);
	return { outcome, events: handlers.events, dataCalls: handlers.dataCalls };
}

describe('readSseResponse', () => {
	it('reports content, thinking, usage and tool calls on a normal stream', async () => {
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null },
				],
			}),
			sseData({
				choices: [
					{
						index: 0,
						delta: { reasoning_content: 'thinking…' },
						finish_reason: null,
					},
				],
			}),
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{
									index: 0,
									id: 'call-1',
									type: 'function',
									function: { name: 'read_file', arguments: '{"pa' },
								},
							],
						},
						finish_reason: null,
					},
				],
			}),
			sseData({
				choices: [
					{
						index: 0,
						delta: { tool_calls: [{ index: 0, function: { arguments: 'th": "x"}' } }] },
						finish_reason: null,
					},
				],
			}),
			sseData({
				choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		if (outcome.kind === 'done') {
			assert.equal(outcome.finishReason, 'tool_calls');
		}
		assert.deepEqual(events, [
			'content:Hello',
			'thinking:thinking…',
			'usage:15',
			'tool:read_file:{"path": "x"}',
		]);
	});

	it('reports tool calls only after [DONE] confirms a healthy stream', async () => {
		// finish_reason=tool_calls arrives mid-stream; the call must not reach
		// the host until [DONE] confirms completion.
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: 'call-1', function: { name: 'run', arguments: '{}' } }],
						},
						finish_reason: 'tool_calls',
					},
				],
			}),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		assert.deepEqual(events, ['tool:run:{}']);
	});

	it('does not report tool calls when the output is truncated (length)', async () => {
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{ index: 0, id: 'call-1', function: { name: 'run', arguments: '{"x"' } },
							],
						},
						finish_reason: null,
					},
				],
			}),
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'length' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'truncated');
		assert.equal(events.length, 0);
	});

	it('does not report tool calls on fatal finish reasons', async () => {
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: 'call-1', function: { name: 'run', arguments: '{}' } }],
						},
						finish_reason: null,
					},
				],
			}),
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'content_filter' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'fatal');
		assert.equal(events.length, 0);
	});

	it('flags truncated output when finish_reason is length', async () => {
		const { outcome, events } = await collect([
			sseData({ choices: [{ index: 0, delta: { content: 'partial' }, finish_reason: null }] }),
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'length' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'truncated');
		assert.deepEqual(events, ['content:partial']);
	});

	it('maps fatal finish reasons to the fatal outcome', async () => {
		const { outcome } = await collect([
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'content_filter' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'fatal');
		if (outcome.kind === 'fatal') {
			assert.equal(outcome.finishReason, 'content_filter');
		}
	});

	it('reports disconnected streams instead of pretending completion', async () => {
		const { outcome, events } = await collect([
			sseData({ choices: [{ index: 0, delta: { content: 'half' }, finish_reason: null }] }),
		]);

		assert.equal(outcome.kind, 'disconnected');
		assert.deepEqual(events, ['content:half']);
	});

	it('accepts data frames without a space after the colon', async () => {
		const { outcome, events } = await collect([
			`data:${JSON.stringify({ choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: null }] })}`,
			'data:[DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		assert.deepEqual(events, ['content:ok']);
	});

	it('treats EOF after a finish_reason as a normal completion (compatible endpoints)', async () => {
		// Some OpenAI-compatible proxies close the stream without [DONE].
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: 'call-1', function: { name: 'run', arguments: '{}' } }],
						},
						finish_reason: 'tool_calls',
					},
				],
			}),
		]);

		assert.equal(outcome.kind, 'done');
		if (outcome.kind === 'done') {
			assert.equal(outcome.finishReason, 'tool_calls');
		}
		// The finish_reason confirms the call set is complete, so it is reported.
		assert.deepEqual(events, ['tool:run:{}']);
	});

	it('still flags a truncated stream that ends after finish_reason length', async () => {
		const { outcome, events } = await collect([
			sseData({ choices: [{ index: 0, delta: { content: 'partial' }, finish_reason: 'length' }] }),
		]);

		assert.equal(outcome.kind, 'truncated');
		assert.deepEqual(events, ['content:partial']);
	});

	it('does not flush pending tool calls on a disconnected stream', async () => {
		const { outcome, events } = await collect([
			sseData({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{ index: 0, id: 'call-1', function: { name: 'run', arguments: '{"x"' } },
							],
						},
						finish_reason: null,
					},
				],
			}),
		]);

		assert.equal(outcome.kind, 'disconnected');
		assert.equal(events.length, 0);
	});

	it('surfaces in-stream error objects from a 200 stream', async () => {
		const { outcome } = await collect([
			sseData({ error: { message: 'OCR did not finish in time', code: 'gateway_timeout_error' } }),
		]);

		assert.equal(outcome.kind, 'server-error');
		if (outcome.kind === 'server-error') {
			assert.equal(outcome.detail, 'OCR did not finish in time');
		}
	});

	it('notifies onData once per received chunk for idle-timeout resets', async () => {
		const { dataCalls } = await collect([
			sseData({ choices: [{ index: 0, delta: { content: 'a' }, finish_reason: null }] }),
			sseData({ choices: [{ index: 0, delta: { content: 'b' }, finish_reason: null }] }),
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }),
			'data: [DONE]',
		]);

		assert.equal(dataCalls, 4);
	});

	it('reports cancellation before consuming the stream', async () => {
		const { outcome, events } = await collect([], { isCancelled: () => true });

		assert.equal(outcome.kind, 'cancelled');
		assert.deepEqual(events, []);
	});

	it('ignores unparsable data lines and SSE comments', async () => {
		const { outcome, events } = await collect([
			': keep-alive comment',
			'data: not-json',
			sseData({ choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: null }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		assert.deepEqual(events, ['content:ok']);
	});

	it('splices a frame cut by a raw newline inside a JSON string', async () => {
		const brokenFrame =
			'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"ask_user","arguments":"{\\"message\\":\\"line one\nline two\\"}"}}]}}]}';
		const { outcome, events } = await collect([
			brokenFrame,
			sseData({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		assert.deepEqual(events, ['tool:ask_user:{"message":"line one\nline two"}']);
	});

	it('drops a half-open frame when the next data frame arrives', async () => {
		const { outcome, events } = await collect([
			'data: {"choices":[{"index":0,"delta":{"content":"lost"',
			sseData({ choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }] }),
			'data: [DONE]',
		]);

		assert.equal(outcome.kind, 'done');
		assert.deepEqual(events, ['content:ok']);
	});
});
