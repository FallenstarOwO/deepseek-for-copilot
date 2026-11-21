import vscode from 'vscode';
import { CONFIG_SECTION } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';

const WARNED_STATE_KEY = 'deepseek-copilot.ignoredEndpointConfigWarned';

export interface IgnoredEndpointConfig {
	baseUrl: boolean;
	requestHeaders: boolean;
}

/**
 * `baseUrl` and `requestHeaders` are machine-scoped, so workspace and folder
 * values are ignored. After upgrading from a build that honoured workspace
 * values, the effective endpoint can change while the stored API key stays the
 * same — that key must not be shipped to a different endpoint without the user
 * noticing. `hasIgnoredEndpointConfig` detects exactly that situation.
 */
export function getIgnoredEndpointConfig(): IgnoredEndpointConfig {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return {
		baseUrl: hasScopedValue(config.inspect('baseUrl')),
		requestHeaders: hasScopedValue(config.inspect('requestHeaders')),
	};
}

export function hasIgnoredEndpointConfig(): boolean {
	const ignored = getIgnoredEndpointConfig();
	return ignored.baseUrl || ignored.requestHeaders;
}

function hasScopedValue(inspection: unknown): boolean {
	if (typeof inspection !== 'object' || inspection === null) {
		return false;
	}
	const { workspaceValue, workspaceFolderValue } = inspection as {
		workspaceValue?: unknown;
		workspaceFolderValue?: unknown;
	};
	return workspaceValue !== undefined || workspaceFolderValue !== undefined;
}

/**
 * Warn once per installation that workspace-scoped endpoint settings are being
 * ignored, and open the user settings when requested. Returns the keys that are
 * ignored so callers can also adapt behaviour.
 */
export async function notifyIgnoredEndpointConfig(
	context: vscode.ExtensionContext,
	ignored: IgnoredEndpointConfig,
): Promise<void> {
	const keys = [
		ignored.baseUrl ? `${CONFIG_SECTION}.baseUrl` : undefined,
		ignored.requestHeaders ? `${CONFIG_SECTION}.requestHeaders` : undefined,
	].filter((key): key is string => Boolean(key));
	if (keys.length === 0) {
		return;
	}

	logger.warn(`Ignoring workspace-scoped settings: ${keys.join(', ')}`);

	if (context.globalState.get<boolean>(WARNED_STATE_KEY)) {
		return;
	}
	await context.globalState.update(WARNED_STATE_KEY, true);

	const openSettings = t('endpointConfig.ignored.openSettings');
	void vscode.window
		.showWarningMessage(t('endpointConfig.ignored.message', keys.join(', ')), openSettings)
		.then((choice) => {
			if (choice === openSettings) {
				void vscode.commands.executeCommand(
					'workbench.action.openSettings',
					`@id:${CONFIG_SECTION}.baseUrl`,
				);
			}
		});
}
