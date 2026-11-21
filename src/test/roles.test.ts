import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapRole } from '../provider/roles';

describe('mapRole', () => {
	it('maps the VS Code System role (3) to the DeepSeek system role', () => {
		assert.equal(mapRole(3), 'system');
	});

	it('maps assistant (2) and user (1)', () => {
		assert.equal(mapRole(2), 'assistant');
		assert.equal(mapRole(1), 'user');
	});

	it('falls back to user for unknown role numbers', () => {
		assert.equal(mapRole(0), 'user');
		assert.equal(mapRole(99), 'user');
	});
});
