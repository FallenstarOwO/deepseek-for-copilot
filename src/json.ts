const REPLACEMENT_CHARACTER = '\uFFFD';
const LONE_SURROGATE_PATTERN = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g;

type WellFormedString = string & {
	toWellFormed?: () => string;
};

export function safeStringify(value: unknown): string {
	const json = JSON.stringify(value, (_key, entryValue: unknown) => {
		if (typeof entryValue === 'string') {
			return toWellFormedString(entryValue);
		}
		return entryValue;
	});

	if (json === undefined) {
		throw new TypeError('Value cannot be serialized as JSON');
	}

	return json;
}

export function toWellFormedString(value: string): string {
	const toWellFormed = (value as WellFormedString).toWellFormed;
	if (typeof toWellFormed === 'function') {
		return toWellFormed.call(value);
	}

	return value.replace(LONE_SURROGATE_PATTERN, (_match, pair: string | undefined) =>
		pair ? pair : REPLACEMENT_CHARACTER,
	);
}

/**
 * Escape raw control characters that appear inside JSON string literals.
 *
 * Providers occasionally stream real newlines or tabs inside strings, which
 * makes an otherwise complete JSON payload unparsable. Escaping them is
 * lossless: the decoded string keeps the same characters.
 */
export function escapeControlCharactersInStrings(text: string): string {
	let result = '';
	let inString = false;
	let escaped = false;

	for (const char of text) {
		if (inString) {
			const codePoint = char.codePointAt(0) ?? 0;
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			} else if (codePoint < 0x20) {
				result += escapeControlCharacter(char);
				continue;
			}
		} else if (char === '"') {
			inString = true;
		}
		result += char;
	}
	return result;
}

function escapeControlCharacter(char: string): string {
	switch (char) {
		case '\n':
			return '\\n';
		case '\r':
			return '\\r';
		case '\t':
			return '\\t';
		case '\b':
			return '\\b';
		case '\f':
			return '\\f';
		default:
			return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
	}
}
