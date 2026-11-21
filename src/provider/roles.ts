import { LANGUAGE_MODEL_CHAT_SYSTEM_ROLE } from '../consts';
import type { LanguageModelChatMessageRole } from 'vscode';

export type MappedRole = 'user' | 'assistant' | 'system';

/** Public enum value of vscode.LanguageModelChatMessageRole.Assistant. */
const ASSISTANT_ROLE = 2;

// VS Code's internal System role (3) is not exposed in the public enum.
const VSCODE_SYSTEM_ROLE = LANGUAGE_MODEL_CHAT_SYSTEM_ROLE as LanguageModelChatMessageRole;

/**
 * Map a VS Code chat message role to a DeepSeek API role.
 *
 * This module is intentionally free of runtime VS Code imports so the mapping
 * stays unit-testable outside the extension host.
 */
export function mapRole(role: LanguageModelChatMessageRole | number): MappedRole {
	if (role === VSCODE_SYSTEM_ROLE) {
		return 'system';
	}
	return role === ASSISTANT_ROLE ? 'assistant' : 'user';
}
