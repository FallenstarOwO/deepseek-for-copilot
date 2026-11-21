import { randomUUID } from 'crypto';
import vscode from 'vscode';
import { EXTERNAL_URLS } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import { getBalanceSnapshot, MissingApiKeyError } from './service';
import type { BalancePanelCommand, BalancePanelState } from './types';
import { BalanceError } from './types';

interface BalancePanel {
	readonly panel: vscode.WebviewPanel;
	refreshSeq: number;
}

let currentPanel: BalancePanel | undefined;

/**
 * Open (or reveal) the DeepSeek balance panel and start a balance query.
 */
export function showBalancePanel(context: vscode.ExtensionContext): void {
	if (currentPanel) {
		currentPanel.panel.reveal();
		void refresh(currentPanel);
		return;
	}

	const iconUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icon.png');
	const panel = vscode.window.createWebviewPanel(
		'deepseekBalance',
		t('balance.panel.title'),
		{ viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
		{ enableScripts: true },
	);
	panel.iconPath = { light: iconUri, dark: iconUri };

	const entry: BalancePanel = { panel, refreshSeq: 0 };
	currentPanel = entry;

	panel.webview.onDidReceiveMessage(
		(message: unknown) => void handlePanelMessage(entry, message),
		null,
		context.subscriptions,
	);
	panel.onDidDispose(
		() => {
			if (currentPanel === entry) {
				currentPanel = undefined;
			}
		},
		null,
		context.subscriptions,
	);
	context.subscriptions.push(panel);

	panel.webview.html = renderHtml(panel.webview);
	void refresh(entry);
}

async function handlePanelMessage(entry: BalancePanel, message: unknown): Promise<void> {
	const command =
		typeof message === 'object' && message !== null
			? (message as { command?: unknown }).command
			: undefined;
	switch (command as BalancePanelCommand) {
		case 'refresh':
			await refresh(entry);
			break;
		case 'setApiKey':
			await vscode.commands.executeCommand('deepseek-copilot.setApiKey');
			await refresh(entry);
			break;
		case 'openUsage':
			await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.deepseek.usage));
			break;
	}
}

async function refresh(entry: BalancePanel): Promise<void> {
	const seq = ++entry.refreshSeq;
	post(entry, { type: 'loading' });

	let state: BalancePanelState;
	try {
		// Force refresh: the panel is an explicit user action, bypass the shared cache.
		const snapshot = await getBalanceSnapshot({ force: true });
		state = {
			type: 'data',
			isAvailable: snapshot.response.is_available,
			balances: snapshot.response.balance_infos.map((info) => ({
				currency: info.currency,
				total: info.total_balance,
				granted: info.granted_balance,
				topUp: info.topped_up_balance,
			})),
			baseUrl: snapshot.baseUrl,
			updatedAt: snapshot.updatedAt,
		};
	} catch (error) {
		logger.warn('Balance query failed', error);
		if (error instanceof MissingApiKeyError) {
			state = { type: 'error', message: error.message, missingApiKey: true };
		} else {
			const message =
				error instanceof BalanceError
					? error.message
					: t('balance.error.unknown', error instanceof Error ? error.message : String(error));
			state = { type: 'error', message };
		}
	}

	// A newer refresh superseded this one; drop the stale result.
	if (seq !== entry.refreshSeq) {
		return;
	}
	post(entry, state);
}

function post(entry: BalancePanel, state: BalancePanelState): void {
	void entry.panel.webview.postMessage(state).then(
		() => undefined,
		() => undefined,
	);
}

function renderHtml(webview: vscode.Webview): string {
	const nonce = randomUUID().replace(/-/gu, '');
	const labels = JSON.stringify({
		loading: t('balance.panel.loading'),
		refresh: t('balance.panel.refresh'),
		retry: t('balance.panel.retry'),
		available: t('balance.panel.available'),
		unavailable: t('balance.panel.unavailable'),
		total: t('balance.panel.total'),
		granted: t('balance.panel.granted'),
		topUp: t('balance.panel.toppedUp'),
		updatedAt: t('balance.panel.updatedAt'),
		viewUsage: t('balance.panel.viewUsage'),
		setApiKey: t('error.action.setApiKey'),
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
</head>
<body>
	<div id="app"></div>
	<script nonce="${nonce}">
		(() => {
			const vscode = acquireVsCodeApi();
			const L = ${labels};
			const root = document.getElementById('app');

			function esc(value) {
				const div = document.createElement('div');
				div.textContent = String(value);
				return div.innerHTML;
			}

			function render(state) {
				if (!state || typeof state !== 'object') {
					return;
				}
				// Persist so a recreated webview (for example after switching
				// editor tabs) restores the last view instead of a dead spinner.
				vscode.setState(state);
				if (state.type === 'loading') {
					root.innerHTML =
						'<div class="loading"><div class="spinner"></div><span>' + esc(L.loading) + '</span></div>';
					return;
				}
				if (state.type === 'data') {
					const badge = state.isAvailable
						? '<span class="badge ok">' + esc(L.available) + '</span>'
						: '<span class="badge bad">' + esc(L.unavailable) + '</span>';
					const cards = state.balances
						.map(
							(b) =>
								'<section class="card">' +
								'<header class="currency">' + esc(b.currency) + '</header>' +
								'<div class="row main"><span>' + esc(L.total) + '</span><strong>' + esc(b.total) + '</strong></div>' +
								'<div class="row"><span>' + esc(L.granted) + '</span><span>' + esc(b.granted) + '</span></div>' +
								'<div class="row"><span>' + esc(L.topUp) + '</span><span>' + esc(b.topUp) + '</span></div>' +
								'</section>',
						)
						.join('');
					root.innerHTML =
						'<div class="toolbar">' + badge + '<button id="refresh" class="btn">' + esc(L.refresh) + '</button></div>' +
						cards +
						'<footer class="meta">' +
						'<span>' + esc(L.updatedAt).replace('{0}', esc(state.updatedAt)) + '</span>' +
						'<span class="sep">&middot;</span>' +
						'<a href="#" id="usage">' + esc(L.viewUsage) + '</a>' +
						'<span class="sep">&middot;</span>' +
						'<span>' + esc(state.baseUrl) + '</span>' +
						'</footer>';
					bind();
					return;
				}
				const actions = [];
				if (state.missingApiKey) {
					actions.push('<button id="setApiKey" class="btn">' + esc(L.setApiKey) + '</button>');
				}
				actions.push('<button id="refresh" class="btn secondary">' + esc(L.retry) + '</button>');
				root.innerHTML =
					'<div class="error">' + esc(state.message) + '</div>' +
					'<div class="actions">' + actions.join('') + '</div>';
				bind();
			}

			function bind() {
				const refreshButton = document.getElementById('refresh');
				if (refreshButton) {
					refreshButton.addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
				}
				const setApiKey = document.getElementById('setApiKey');
				if (setApiKey) {
					setApiKey.addEventListener('click', () => vscode.postMessage({ command: 'setApiKey' }));
				}
				const usage = document.getElementById('usage');
				if (usage) {
					usage.addEventListener('click', (event) => {
						event.preventDefault();
						vscode.postMessage({ command: 'openUsage' });
					});
				}
			}

			window.addEventListener('message', (event) => render(event.data));
			render(vscode.getState() || { type: 'loading' });
		})();
	</script>
	<style>
		body {
			padding: 16px 20px;
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size, 13px);
		}
		.loading {
			display: flex;
			align-items: center;
			gap: 10px;
			padding-top: 24px;
			color: var(--vscode-descriptionForeground);
		}
		.spinner {
			width: 16px;
			height: 16px;
			border: 2px solid var(--vscode-descriptionForeground);
			border-top-color: transparent;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
		}
		@keyframes spin {
			to {
				transform: rotate(360deg);
			}
		}
		.toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 16px;
		}
		.badge {
			font-weight: 600;
			font-size: 12px;
		}
		.badge.ok::before {
			content: '\\25CF';
			margin-right: 6px;
			color: var(--vscode-charts-green, #3fb950);
		}
		.badge.bad::before {
			content: '\\25CF';
			margin-right: 6px;
			color: var(--vscode-charts-red, #f85149);
		}
		.card {
			border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
			border-radius: 6px;
			padding: 12px 16px;
			margin-bottom: 12px;
			max-width: 420px;
		}
		.card .currency {
			font-weight: 600;
			margin-bottom: 8px;
		}
		.row {
			display: flex;
			justify-content: space-between;
			padding: 3px 0;
		}
		.row span:first-child {
			color: var(--vscode-descriptionForeground);
		}
		.row.main strong {
			font-size: 16px;
		}
		.meta {
			margin-top: 16px;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
		}
		.meta a {
			color: var(--vscode-textLink-foreground);
			cursor: pointer;
			text-decoration: none;
		}
		.meta a:hover {
			text-decoration: underline;
		}
		.error {
			color: var(--vscode-errorForeground);
			margin-bottom: 12px;
			max-width: 560px;
			white-space: pre-wrap;
		}
		.actions {
			display: flex;
			gap: 8px;
		}
		.btn {
			border: none;
			border-radius: 2px;
			padding: 4px 14px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			cursor: pointer;
			font-family: inherit;
			font-size: 12px;
		}
		.btn:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.btn.secondary {
			color: var(--vscode-button-secondaryForeground);
			background: var(--vscode-button-secondaryBackground);
		}
		.btn.secondary:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}
	</style>
</body>
</html>`;
}
