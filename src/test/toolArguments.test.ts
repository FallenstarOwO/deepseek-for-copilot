import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseToolArguments } from '../provider/tools/arguments';

describe('parseToolArguments', () => {
	it('parses strict JSON', () => {
		const result = parseToolArguments('{"message":"hi","count":2}');
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.value, { message: 'hi', count: 2 });
		assert.deepEqual(result.ok && result.repairedBy, []);
	});

	it('treats blank arguments as an empty object', () => {
		const result = parseToolArguments('   ');
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.value, {});
	});

	it('repairs raw newlines inside a long string', () => {
		const raw =
			'{"message":"line one\nline two\n\n1. step","requestedSchema":{"required":["where"]}}';
		const result = parseToolArguments(raw);
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.repairedBy, ['control-characters']);
		assert.equal(result.ok && (result.value.message as string), 'line one\nline two\n\n1. step');
	});

	it('repairs trailing commas', () => {
		const result = parseToolArguments('{"a":1,"b":[1,2,],}');
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.value, { a: 1, b: [1, 2] });
		assert.deepEqual(result.ok && result.repairedBy, ['trailing-comma']);
	});

	it('unwraps fenced or prefixed payloads', () => {
		const result = parseToolArguments('```json\n{"message":"hi"}\n```');
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.value, { message: 'hi' });
		assert.deepEqual(result.ok && result.repairedBy, ['unwrapped']);
	});

	it('drops a second concatenated payload', () => {
		const result = parseToolArguments('{"message":"hi"}{"message":"hi"}');
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok && result.value, { message: 'hi' });
	});

	it('reports truncated payloads instead of repairing them', () => {
		const result = parseToolArguments(
			'{"message":"hi","requestedSchema":{"properties":{"where":{"type":"str',
		);
		assert.equal(result.ok, false);
		assert.equal(!result.ok && result.reason, 'truncated');
	});

	it('reports syntax errors that are not truncation', () => {
		const result = parseToolArguments('{"message":hi}');
		assert.equal(result.ok, false);
		assert.equal(!result.ok && result.reason, 'syntax');
	});

	it('rejects non-object payloads', () => {
		const result = parseToolArguments('"just a string"');
		assert.equal(result.ok, false);
		assert.equal(!result.ok && result.reason, 'syntax');
	});
});
