import { t } from '../i18n';
import type { OcrResponse } from './types';

export const OCR_TOTAL_CHAR_LIMIT = 200_000;

/**
 * Format OCR results as paged plain text for a language model.
 */
export function formatOcrResult(fileName: string, response: OcrResponse): string {
	const pages = response.pages.filter((page) => page.text.trim().length > 0);
	if (pages.length === 0) {
		return t('tools.output.ocr.empty');
	}

	const blocks = pages.map((page) => {
		const label = t('tools.output.ocr.page', (page.index ?? pages.indexOf(page)) + 1);
		const incomplete =
			page.finish_reason === 'length' ? ` ${t('tools.output.ocr.incomplete')}` : '';
		return `[${label}]${incomplete}\n${page.text}`;
	});

	const header = t('tools.output.ocr.header', fileName, response.page_count ?? pages.length);
	const fullText = `${header}\n\n${blocks.join('\n\n')}`;
	if (fullText.length <= OCR_TOTAL_CHAR_LIMIT) {
		return fullText;
	}

	const kept = fullText.slice(0, OCR_TOTAL_CHAR_LIMIT);
	return `${kept}\n${t('tools.output.truncated', kept.length, fullText.length)}`;
}
