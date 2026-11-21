import type vscode from 'vscode';
import { AuthManager } from '../auth';
import { getApiModelId, getBaseUrl } from '../config';
import { MODELS } from '../consts';
import { isOfficialDeepSeekBaseUrl, normalizeBaseUrl } from '../endpoint';
import { logger } from '../logger';

const MODELS_TIMEOUT_MS = 10_000;

/**
 * Best-effort background check that each configured `modelIdOverrides` entry
 * exists in the official `GET /models` list. Diagnostics only — failures are
 * logged, never surfaced to the user, and skipped entirely on custom endpoints
 * where the /models shape is not guaranteed.
 */
export function verifyModelOverridesInBackground(context: vscode.ExtensionContext): void {
	void verifyModelOverrides(new AuthManager(context));
}

async function verifyModelOverrides(auth: AuthManager): Promise<void> {
	try {
		const baseUrl = normalizeBaseUrl(getBaseUrl());
		if (!isOfficialDeepSeekBaseUrl(baseUrl)) {
			return;
		}
		const overrides = MODELS.map((model) => ({
			vscodeId: model.id,
			apiId: getApiModelId(model.id),
		})).filter((entry) => entry.apiId !== entry.vscodeId);
		if (overrides.length === 0) {
			return;
		}

		const apiKey = await auth.getApiKey();
		if (!apiKey) {
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), MODELS_TIMEOUT_MS);
		try {
			const response = await fetch(`${new URL(baseUrl).origin}/models`, {
				headers: { Authorization: `Bearer ${apiKey}` },
				signal: controller.signal,
			});
			if (!response.ok) {
				logger.debug(`Model discovery skipped: GET /models returned HTTP ${response.status}`);
				return;
			}
			const data = (await response.json()) as { data?: Array<{ id?: unknown }> };
			const knownIds = new Set(
				(data.data ?? [])
					.map((model) => model.id)
					.filter((id): id is string => typeof id === 'string'),
			);
			for (const entry of overrides) {
				if (!knownIds.has(entry.apiId)) {
					logger.warn(
						`modelIdOverrides: "${entry.apiId}" (for ${entry.vscodeId}) was not found in GET /models. Requests may fail with an unknown-model error.`,
					);
				}
			}
		} finally {
			clearTimeout(timer);
		}
	} catch {
		// Diagnostics only; ignore any failure (network, parse, abort).
	}
}
