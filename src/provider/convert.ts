import vscode from 'vscode';
import { safeStringify } from '../json';
import type {
	DeepSeekContentPart,
	DeepSeekMessage,
	DeepSeekTool,
	DeepSeekToolCall,
} from '../types';
import { parseFirstReplayMarker, REPLAY_MARKER_MIME } from './replay';
import { mapRole } from './roles';

const IMAGE_OMITTED_NOTICE = '[Image omitted: the selected model does not support image input]';

/**
 * Shown to the model when a non-image attachment (for example a PDF or Word
 * document) is dropped. Unlike images, the API has no document content part,
 * so silently discarding it would make the model answer as if nothing was
 * attached. The notice names the remedy so the model can relay it.
 */
const DOCUMENT_OMITTED_NOTICE =
	'[File omitted: non-image file attachments are not sent to the model. To read a document, ask the user to enable "deepseek-copilot.ocr.enabled" in Settings and pass the file path to the #deepseekOcr tool, or convert the document to text and attach that instead.]';

/**
 * Convert VS Code chat messages to DeepSeek format.
 * Injects marker-replayed reasoning_content for assistant messages.
 */
export function convertMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	isThinkingModel: boolean,
	imageInput: boolean,
): DeepSeekMessage[] {
	const result: DeepSeekMessage[] = [];

	for (const message of messages) {
		const role = mapRole(message.role);

		let content = '';
		const nativeVisionContentParts: DeepSeekContentPart[] = [];
		let thinkingContent = '';
		const toolCalls: DeepSeekToolCall[] = [];
		const toolResults: NormalizedToolResult[] = [];
		let documentOmitted = false;

		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				if (content.endsWith(IMAGE_OMITTED_NOTICE)) {
					content += '\n';
				}
				content += part.value;
				if (imageInput && role === 'user') {
					nativeVisionContentParts.push({
						type: 'text',
						text: part.value,
					});
				}
			} else if (imageInput && role === 'user' && isImageDataPart(part)) {
				nativeVisionContentParts.push({
					type: 'image_url',
					image_url: {
						url: toImageDataUrl(part),
					},
				});
			} else if (!imageInput && role === 'user' && isImageDataPart(part)) {
				// Text-only models cannot receive the image bytes; keep a visible
				// placeholder so the user message itself is not dropped.
				content += (content ? '\n' : '') + IMAGE_OMITTED_NOTICE;
			} else if (role === 'user' && isNonImageDataPart(part)) {
				// There is no document content part in the API; flag the attachment
				// so the model never answers as if nothing was sent.
				documentOmitted = true;
			} else if (isLanguageModelThinkingPart(part)) {
				thinkingContent += normalizeThinkingPartText(part.value);
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				toolCalls.push({
					id: part.callId,
					type: 'function',
					function: {
						name: part.name,
						arguments: safeStringify(part.input),
					},
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				toolResults.push(normalizeToolResult(part));
			}
		}

		if (documentOmitted) {
			content += (content ? '\n' : '') + DOCUMENT_OMITTED_NOTICE;
			if (imageInput && role === 'user') {
				// Vision-capable user messages are sent as a content-part array, so
				// the plain string above is discarded — mirror the notice there.
				nativeVisionContentParts.push({ type: 'text', text: DOCUMENT_OMITTED_NOTICE });
			}
		}

		if (role === 'assistant') {
			if (content || toolCalls.length > 0) {
				const replayMarker = isThinkingModel ? parseFirstReplayMarker(message) : undefined;
				const msg: DeepSeekMessage = {
					role: 'assistant' as const,
					content: content || '',
				};

				if (toolCalls.length > 0) {
					msg.tool_calls = toolCalls;
				}

				if (isThinkingModel) {
					msg.reasoning_content = getReasoningContent(replayMarker, thinkingContent);
				}

				result.push(msg);
			}
		} else if (role === 'system') {
			if (content) {
				result.push({
					role: 'system',
					content,
				});
			}
		} else {
			if (imageInput && role === 'user' && nativeVisionContentParts.length > 0) {
				result.push({
					role: 'user',
					content: nativeVisionContentParts,
				});
			} else if (content) {
				result.push({
					role: role as 'user',
					content: content,
				});
			}
		}

		// Tool result messages follow their associated assistant message
		for (const tr of toolResults) {
			result.push({
				role: 'tool',
				content: convertToolResultContent(tr, imageInput),
				tool_call_id: tr.callId,
			});
		}
	}

	return result;
}

function toImageDataUrl(part: { mimeType: string; data: Uint8Array }): string {
	return `data:${part.mimeType};base64,${Buffer.from(part.data).toString('base64')}`;
}

function convertToolResultContent(
	toolResult: NormalizedToolResult,
	imageInput: boolean,
): DeepSeekMessage['content'] {
	const hasImages = toolResult.parts.some((part) => part.type === 'image');
	if (imageInput && hasImages) {
		const content: DeepSeekContentPart[] = [];
		let omittedNonImageData = false;
		for (const part of toolResult.parts) {
			if (part.type === 'text') {
				content.push({ type: 'text', text: part.text });
			} else if (part.type === 'image') {
				content.push({
					type: 'image_url',
					image_url: { url: toImageDataUrl(part) },
				});
			} else if (isNonImageDataPart(part.value)) {
				omittedNonImageData = true;
			}
		}
		if (omittedNonImageData) {
			// Tool messages must carry content; surface the omission so the model
			// does not assume the tool returned nothing for the attachment.
			content.push({ type: 'text', text: DOCUMENT_OMITTED_NOTICE });
		}
		return content;
	}

	const text = toolResult.parts
		.filter((part) => part.type === 'text')
		.map((part) => part.text)
		.join('');
	const notices: string[] = [];
	if (!imageInput && hasImages) {
		notices.push(IMAGE_OMITTED_NOTICE);
	}
	if (toolResult.parts.some((part) => part.type === 'other' && isNonImageDataPart(part.value))) {
		notices.push(DOCUMENT_OMITTED_NOTICE);
	}
	const noticeSuffix = notices.join('\n');

	if (text) {
		return noticeSuffix ? `${text}\n${noticeSuffix}` : text;
	}

	// Serialize only non-binary content: a LanguageModelDataPart would otherwise
	// be JSON-stringified into the prompt, shipping raw file bytes as text.
	const serializable = toolResult.originalContent.filter(
		(part) => !(part instanceof vscode.LanguageModelDataPart),
	);
	const fallback = serializable.length > 0 ? safeStringify(serializable) : '';
	if (fallback) {
		return noticeSuffix ? `${fallback}\n${noticeSuffix}` : fallback;
	}
	return noticeSuffix;
}

function getReasoningContent(
	replayMarker: ReturnType<typeof parseFirstReplayMarker>,
	thinkingContent: string,
): string {
	if (replayMarker?.valid && replayMarker.reasoningText) {
		return replayMarker.reasoningText;
	}
	return thinkingContent;
}

function isLanguageModelThinkingPart(part: unknown): part is vscode.LanguageModelThinkingPart {
	return (
		typeof vscode.LanguageModelThinkingPart === 'function' &&
		part instanceof vscode.LanguageModelThinkingPart
	);
}

function normalizeThinkingPartText(value: string | string[]): string {
	return Array.isArray(value) ? value.join('') : value;
}

// VS Code's internal System role (3) is not exposed in the public enum.
// mapRole now lives in ./roles (runtime-vscode-free) for unit testing.

/**
 * Convert VS Code tool definitions to DeepSeek format.
 */
export function convertTools(
	tools: readonly vscode.LanguageModelChatTool[] | undefined,
): DeepSeekTool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}

	return tools.map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			// Some compatible endpoints require an explicit schema for tools without parameters.
			parameters: (tool.inputSchema ?? { type: 'object', properties: {} }) as Record<
				string,
				unknown
			>,
		},
	}));
}

/**
 * Count total characters across all messages to calibrate chars-per-token ratio.
 */
export function countMessageChars(messages: DeepSeekMessage[]): number {
	let total = 0;
	for (const msg of messages) {
		total += getMessageContentChars(msg.content);
		total += msg.reasoning_content?.length ?? 0;
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += tc.function?.name?.length ?? 0;
				total += tc.function?.arguments?.length ?? 0;
			}
		}
	}
	return total;
}

function getMessageContentChars(content: DeepSeekMessage['content']): number {
	if (typeof content === 'string') {
		return content.length;
	}

	let total = 0;
	for (const part of content) {
		if (part.type === 'text') {
			total += part.text.length;
		} else if (part.type === 'image_url') {
			// Do not count base64 URL chars. Native-image requests are excluded from
			// adaptive charsPerToken updates, and image cost is handled separately.
			total += 0;
		}
	}
	return total;
}

/** Whether any converted message forwards an image part to the API. */
export function hasImageParts(messages: DeepSeekMessage[]): boolean {
	for (const msg of messages) {
		const content = msg.content;
		if (typeof content === 'string') {
			continue;
		}

		for (const part of content) {
			if (part.type === 'image_url') {
				return true;
			}
		}
	}
	return false;
}

export type NormalizedToolResultContentPart =
	| {
			type: 'text';
			text: string;
	  }
	| {
			type: 'image';
			mimeType: string;
			data: Uint8Array;
	  }
	| {
			type: 'other';
			value: unknown;
	  };

export interface NormalizedToolResult {
	callId: string;
	parts: NormalizedToolResultContentPart[];
	originalContent: readonly unknown[];
}

/**
 * Normalize a tool result without making any model-routing decisions.
 *
 * Only actual image data parts are classified as images. Tool names, tool-call
 * input paths, resource URIs, and other opaque values are deliberately not
 * inspected or hydrated here.
 */
export function normalizeToolResult(
	part: vscode.LanguageModelToolResultPart,
): NormalizedToolResult {
	return {
		callId: part.callId,
		parts: part.content.map(normalizeToolResultContentPart),
		originalContent: part.content,
	};
}

export function isImageDataPart(part: unknown): part is vscode.LanguageModelDataPart {
	return (
		part instanceof vscode.LanguageModelDataPart && part.mimeType.toLowerCase().startsWith('image/')
	);
}

/** Attachment data parts the API cannot represent (documents, archives, …). */
function isNonImageDataPart(part: unknown): part is vscode.LanguageModelDataPart {
	return (
		part instanceof vscode.LanguageModelDataPart &&
		!part.mimeType.toLowerCase().startsWith('image/') &&
		// Extension-owned replay markers are not user attachments.
		part.mimeType !== REPLAY_MARKER_MIME
	);
}

function normalizeToolResultContentPart(item: unknown): NormalizedToolResultContentPart {
	if (item instanceof vscode.LanguageModelTextPart) {
		return { type: 'text', text: item.value };
	}
	if (isImageDataPart(item)) {
		return {
			type: 'image',
			mimeType: item.mimeType,
			data: item.data,
		};
	}
	return { type: 'other', value: item };
}
