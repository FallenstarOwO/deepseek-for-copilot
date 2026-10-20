import { t } from '../i18n';
import type { WebFetchResponse, WebSearchResponse } from './types';

export const SEARCH_TOTAL_CHAR_LIMIT = 200_000;
export const SEARCH_CONTENT_CHAR_LIMIT = 20_000;
export const FETCH_CONTENT_CHAR_LIMIT = 200_000;

interface TruncatedText {
	text: string;
	kept: number;
	total: number;
	truncated: boolean;
}

function truncateText(value: string, limit: number): TruncatedText {
	if (value.length <= limit) {
		return { text: value, kept: value.length, total: value.length, truncated: false };
	}
	return { text: value.slice(0, limit), kept: limit, total: value.length, truncated: true };
}

/**
 * Format Search API results as compact Markdown for a language model.
 */
export function formatSearchResults(response: WebSearchResponse): string {
	const results = response.results;
	if (results.length === 0) {
		return t('tools.output.search.empty');
	}

	const blocks: string[] = [];
	for (let index = 0; index < results.length; index++) {
		const result = results[index];
		if (typeof result !== 'object' || result === null) {
			continue;
		}

		const title = result.title ?? '';
		const url = result.url ?? '';
		const lines: string[] = [`${blocks.length + 1}. ${title}`, `   URL: ${url}`];

		const date = result.date ?? '';
		const siteName = result.site_name ?? '';
		const meta: string[] = [];
		if (date) {
			meta.push(`Published: ${date}`);
		}
		if (siteName) {
			meta.push(`Site: ${siteName}`);
		}
		if (typeof result.authority === 'number' && Number.isFinite(result.authority)) {
			meta.push(`Authority: ${result.authority}`);
		}
		if (typeof result.rerank_score === 'number' && Number.isFinite(result.rerank_score)) {
			meta.push(`Rerank score: ${result.rerank_score}`);
		}
		if (meta.length > 0) {
			lines.push(`   ${meta.join(' | ')}`);
		}

		const summary = result.summary || result.snippet || '';
		if (summary) {
			lines.push(`   Summary: ${summary}`);
		}

		const contentText = result.content ?? '';
		if (contentText) {
			const content = truncateText(contentText, SEARCH_CONTENT_CHAR_LIMIT);
			const suffix = content.truncated
				? ` ${t('tools.output.truncated', content.kept, content.total)}`
				: '';
			lines.push(`   Content: ${content.text}${suffix}`);
		}

		blocks.push(lines.join('\n'));
	}

	const fullText = blocks.join('\n\n');
	if (fullText.length <= SEARCH_TOTAL_CHAR_LIMIT) {
		return fullText;
	}

	let kept = '';
	for (const block of blocks) {
		const candidate = kept ? `${kept}\n\n${block}` : block;
		if (candidate.length > SEARCH_TOTAL_CHAR_LIMIT) {
			break;
		}
		kept = candidate;
	}
	return `${kept}\n${t('tools.output.truncated', kept.length, fullText.length)}`;
}

/**
 * Format a Fetch API response as Markdown for a language model.
 */
export function formatFetchResult(response: WebFetchResponse): string {
	const content = truncateText(response.content, FETCH_CONTENT_CHAR_LIMIT);
	const body = content.truncated
		? `${content.text}\n\n${t('tools.output.truncated', content.kept, content.total)}`
		: content.text;
	return response.title ? `# ${response.title}\n\n${body}` : body;
}
