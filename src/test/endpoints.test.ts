import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAccountEndpoint, buildEndpointUrl, buildToolEndpoint } from '../endpoint';

describe('endpoint builders', () => {
	it('appends to the origin for the official base URL', () => {
		assert.equal(
			buildEndpointUrl('https://api.deepseek.com', '/user/balance'),
			'https://api.deepseek.com/user/balance',
		);
		assert.equal(
			buildEndpointUrl('https://api.deepseek.com/', '/user/balance'),
			'https://api.deepseek.com/user/balance',
		);
		// The official host also serves /v1 for OpenAI compatibility; the path
		// segment must be ignored rather than prefixed.
		assert.equal(
			buildEndpointUrl('https://api.deepseek.com/v1', '/user/balance'),
			'https://api.deepseek.com/user/balance',
		);
	});

	it('strips a trailing /v1 from custom base URLs', () => {
		assert.equal(
			buildEndpointUrl('https://proxy.example.com/v1', '/v1/tools/ocr'),
			'https://proxy.example.com/v1/tools/ocr',
		);
		assert.equal(
			buildEndpointUrl('https://proxy.example.com', '/user/balance'),
			'https://proxy.example.com/user/balance',
		);
	});

	it('keeps non-/v1 path segments on custom base URLs', () => {
		assert.equal(
			buildEndpointUrl('https://proxy.example.com/api', '/v1/tools/search'),
			'https://proxy.example.com/api/v1/tools/search',
		);
	});

	it('builds tool endpoints for search, fetch and ocr', () => {
		assert.equal(
			buildToolEndpoint('https://api.deepseek.com', 'search'),
			'https://api.deepseek.com/v1/tools/search',
		);
		assert.equal(
			buildToolEndpoint('https://api.deepseek.com', 'fetch'),
			'https://api.deepseek.com/v1/tools/fetch',
		);
		assert.equal(
			buildToolEndpoint('https://proxy.example.com/v1', 'ocr'),
			'https://proxy.example.com/v1/tools/ocr',
		);
	});

	it('builds account endpoints at the service root', () => {
		assert.equal(
			buildAccountEndpoint('https://api.deepseek.com', '/user/balance'),
			'https://api.deepseek.com/user/balance',
		);
		assert.equal(
			buildAccountEndpoint('https://api.deepseek.com/v1', '/user/balance'),
			'https://api.deepseek.com/user/balance',
		);
	});
});
