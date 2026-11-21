import vscode from 'vscode';
import { attachBalanceService, registerBalanceStatusBar } from '../balance';
import { t } from '../i18n';
import { logger } from '../logger';
import { registerActionUrls } from './actions';
import { registerCommands } from './commands';
import { initializeDiagnostics } from './diagnostics';
import { getIgnoredEndpointConfig, notifyIgnoredEndpointConfig } from './endpointGuard';
import { registerProvider } from './provider';
import { verifyModelOverridesInBackground } from '../provider/modelDiscovery';
import { registerLanguageModelTools } from './tools';
import { showWelcomeIfNeeded } from './welcome';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	await initializeDiagnostics(context);
	registerCommands(context);
	registerActionUrls(context);

	try {
		// Bind the shared balance service first so listeners have credentials and
		// change-tracking available.
		attachBalanceService(context);
		const ignored = getIgnoredEndpointConfig();
		if (ignored.baseUrl || ignored.requestHeaders) {
			// The stored key may belong to the endpoint the ignored workspace
			// config pointed at. Do not run the automatic balance query until the
			// user confirms the new endpoint and key.
			await notifyIgnoredEndpointConfig(context, ignored);
			logger.warn('Balance status bar disabled: ignored workspace endpoint settings detected');
		} else {
			registerBalanceStatusBar(context);
		}
	} catch (error) {
		logger.warn(t('balance.statusBar.registerFailed'), error);
	}

	try {
		registerLanguageModelTools(context);
	} catch (error) {
		logger.warn(t('extension.toolsRegisterFailed'), error);
	}

	try {
		const provider = registerProvider(context);
		verifyModelOverridesInBackground(context);

		void showWelcomeIfNeeded(context, provider).catch((error) => {
			logger.warn(t('extension.welcomeFailed'), error);
		});

		logger.info(`Extension activated version=${context.extension.packageJSON.version}`);
	} catch (error) {
		logger.error('Failed to activate DeepSeek extension', error);
		void vscode.window.showErrorMessage(t('extension.activateFailed'));
		throw error;
	}
}

export function deactivate(): void {
	// VS Code closes extension-host RPC before deactivation; only release local resources here.
	logger.info('Extension deactivated');
	logger.dispose();
}
