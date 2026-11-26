/**
 * Parsing of streamed tool-call arguments.
 *
 * DeepSeek occasionally streams arguments that are not strict JSON: long
 * multi-line strings sometimes contain raw control characters, and models add
 * trailing commas or markdown fences. Aborting on the first `JSON.parse`
 * failure throws away an otherwise usable call, so the payload is repaired
 * with conservative, lossless fixes before giving up.
 */

import { escapeControlCharactersInStrings } from '../../json';

export type ToolArgumentsRepair = 'unwrapped' | 'control-characters' | 'trailing-comma';

export type ToolArgumentsFailureReason = 'truncated' | 'syntax';

export type ToolArgumentsParseResult =
	| { ok: true; value: Record<string, unknown>; repairedBy: ToolArgumentsRepair[] }
	| { ok: false; reason: ToolArgumentsFailureReason; detail: string; offset?: number };

interface RawParseSuccess {
	ok: true;
	value: unknown;
}

interface RawParseFailure {
	ok: false;
	detail: string;
	offset?: number;
}

export function parseToolArguments(rawArguments: string): ToolArgumentsParseResult {
	const raw = rawArguments.replace(/^\uFEFF/, '').trim();
	if (raw.length === 0) {
		// Zero-parameter tools legitimately send empty arguments.
		return { ok: true, value: {}, repairedBy: [] };
	}

	const strict = tryParse(raw);
	if (strict.ok) {
		return toResult(strict.value, []);
	}

	// A payload cut mid-value (by `max_tokens` or a dropped stream chunk) cannot
	// be repaired without inventing data, so report it separately: the caller
	// can then point at the output limit instead of a generic syntax error.
	if (isTruncatedJson(raw)) {
		return { ok: false, reason: 'truncated', detail: strict.detail, offset: strict.offset };
	}

	const repairs: ToolArgumentsRepair[] = [];
	let candidate = raw;

	const unwrapped = unwrapJsonValue(candidate);
	if (unwrapped !== undefined && unwrapped !== candidate) {
		candidate = unwrapped;
		repairs.push('unwrapped');
	}

	const escaped = escapeControlCharactersInStrings(candidate);
	if (escaped !== candidate) {
		candidate = escaped;
		repairs.push('control-characters');
	}

	const withoutTrailingCommas = removeTrailingCommas(candidate);
	if (withoutTrailingCommas !== candidate) {
		candidate = withoutTrailingCommas;
		repairs.push('trailing-comma');
	}

	const repaired = tryParse(candidate);
	if (repaired.ok) {
		return toResult(repaired.value, repairs);
	}
	return { ok: false, reason: 'syntax', detail: repaired.detail, offset: repaired.offset };
}

function toResult(value: unknown, repairedBy: ToolArgumentsRepair[]): ToolArgumentsParseResult {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {
			ok: false,
			reason: 'syntax',
			detail: `expected a JSON object, got ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`,
		};
	}
	return { ok: true, value: value as Record<string, unknown>, repairedBy };
}

function tryParse(text: string): RawParseSuccess | RawParseFailure {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		const offset = parseErrorOffset(detail);
		return offset === undefined ? { ok: false, detail } : { ok: false, detail, offset };
	}
}

function parseErrorOffset(detail: string): number | undefined {
	const match = /\bposition (\d+)/.exec(detail);
	return match ? Number(match[1]) : undefined;
}

/**
 * Detect a payload that ends inside a value: an open string, an unclosed
 * container, or a trailing `,`/`:` that still expects more input.
 */
function isTruncatedJson(text: string): boolean {
	let depth = 0;
	let inString = false;
	let escaped = false;
	let lastSignificant = '';

	for (const char of text) {
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			lastSignificant = char;
			continue;
		}
		if (char === '{' || char === '[') {
			depth += 1;
		} else if (char === '}' || char === ']') {
			depth -= 1;
			if (depth < 0) {
				return false;
			}
		}
		if (!/\s/.test(char)) {
			lastSignificant = char;
		}
	}

	if (inString || depth > 0) {
		return true;
	}
	return lastSignificant === ',' || lastSignificant === ':';
}

/**
 * Cut prose, code fences, or a second concatenated object around the first
 * complete JSON value.
 */
function unwrapJsonValue(text: string): string | undefined {
	const start = findFirstContainerStart(text);
	if (start < 0) {
		return undefined;
	}
	const end = findMatchingContainerEnd(text, start);
	if (end < 0) {
		return undefined;
	}
	return text.slice(start, end + 1);
}

function findFirstContainerStart(text: string): number {
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '{' || char === '[') {
			return index;
		}
	}
	return -1;
}

function findMatchingContainerEnd(text: string, start: number): number {
	const closers: string[] = [];
	let inString = false;
	let escaped = false;

	for (let index = start; index < text.length; index += 1) {
		const char = text[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
		} else if (char === '{') {
			closers.push('}');
		} else if (char === '[') {
			closers.push(']');
		} else if (char === '}' || char === ']') {
			if (closers.pop() !== char) {
				return -1;
			}
			if (closers.length === 0) {
				return index;
			}
		}
	}
	return -1;
}

/** Drop commas that sit directly before a closing `}` or `]`. */
function removeTrailingCommas(text: string): string {
	let result = '';
	let inString = false;
	let escaped = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			result += char;
			continue;
		}
		if (char === '"') {
			inString = true;
			result += char;
			continue;
		}
		if (char === ',') {
			const next = findNextSignificantChar(text, index + 1);
			if (next === '}' || next === ']') {
				continue;
			}
		}
		result += char;
	}
	return result;
}

function findNextSignificantChar(text: string, from: number): string | undefined {
	for (let index = from; index < text.length; index += 1) {
		if (!/\s/.test(text[index])) {
			return text[index];
		}
	}
	return undefined;
}
