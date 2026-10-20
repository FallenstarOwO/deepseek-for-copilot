/**
 * Types for the standalone DeepSeek Search and Fetch APIs
 * (`POST /v1/tools/search` and `POST /v1/tools/fetch`).
 */

export interface WebSearchInput {
	query: string;
	count?: number;
	ori_question?: string;
	localization?: string;
	need_content?: boolean;
}

export interface WebSearchResult {
	rerank_score: number;
	title: string;
	url: string;
	snippet: string;
	summary: string;
	content: string;
	site_name: string | null;
	site_icon: string | null;
	date: string | null;
	authority: number;
}

export interface WebSearchResponse {
	results: WebSearchResult[];
}

export interface WebFetchInput {
	url: string;
}

export interface WebFetchResponse {
	title: string;
	content: string;
}

/** OpenAI-style error envelope returned by the DeepSeek tools APIs. */
export interface WebToolsApiErrorBody {
	error?: {
		message?: string;
		type?: string;
		param?: string | null;
		code?: string | null;
	};
}

export type WebToolsErrorKind =
	| 'http'
	| 'timeout'
	| 'network'
	| 'invalid-response'
	| 'cancelled'
	| 'unknown';

/** Error raised by the web tools client. Never contains the API key. */
export class WebToolsError extends Error {
	constructor(
		readonly kind: WebToolsErrorKind,
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = 'WebToolsError';
	}
}
