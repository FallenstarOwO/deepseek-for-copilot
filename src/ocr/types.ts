/**
 * Types for the standalone DeepSeek OCR API (`POST /v1/tools/ocr`).
 */

export type OcrPurpose = 'text_recognition' | 'rich_layout_recognition';

export interface OcrInput {
	path: string;
	purpose?: OcrPurpose;
}

export interface OcrFile {
	data: Uint8Array;
	fileName: string;
}

export interface OcrPage {
	index?: number;
	text: string;
	finish_reason?: string;
}

export interface OcrResponse {
	id?: string;
	purpose?: string;
	page_count?: number;
	pages: OcrPage[];
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		total_tokens?: number;
	};
}
