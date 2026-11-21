import vscode from 'vscode';
import { getBalanceRefreshIntervalMinutes, isBalanceStatusBarEnabled } from '../config';
import { t } from '../i18n';
import { logger } from '../logger';
import { getBalanceSnapshot, MissingApiKeyError, onBalanceDidChange } from './service';
import type { DeepSeekBalanceResponse } from './types';
import { BalanceError } from './types';

const STATUS_BAR_PRIORITY = 100;
const MIN_REFRESH_MINUTES = 5;

const CURRENCY_SYMBOLS: Record<string, string> = {
	CNY: '¥',
	USD: '$',
};

let sharedController: BalanceStatusBarController | undefined;

/**
 * Register the status bar balance item. Hidden automatically when no API key
 * is configured or the endpoint does not provide GET /user/balance.
 */
export function registerBalanceStatusBar(context: vscode.ExtensionContext): void {
	sharedController = new BalanceStatusBarController(context);
	context.subscriptions.push(sharedController);
	context.subscriptions.push(
		// Internal command (not contributed to the palette): clicking the item refreshes.
		vscode.commands.registerCommand('deepseek-copilot.refreshBalanceStatus', () => {
			sharedController?.forceRefresh();
		}),
	);
}

class BalanceStatusBarController implements vscode.Disposable {
	private timer: NodeJS.Timeout | undefined;
	private inFlight = false;
	private unsupported = false;
	private enabled = false;
	private lastBalanceText: string | undefined;
	private readonly item: vscode.StatusBarItem;
	private readonly configListener: vscode.Disposable;
	private readonly serviceListener: vscode.Disposable;

	constructor(context: vscode.ExtensionContext) {
		this.item = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			STATUS_BAR_PRIORITY,
		);
		this.item.name = t('balance.statusBar.name');
		this.item.command = 'deepseek-copilot.refreshBalanceStatus';
		this.configListener = vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('deepseek-copilot.statusBar.balance')) {
				this.restart();
			}
		});
		// The shared service dedupes requests; adopt fresh data immediately and
		// restart polling when the endpoint or credentials change.
		this.serviceListener = onBalanceDidChange((event) => {
			if (event.type === 'updated') {
				if (this.enabled) {
					this.render(event.snapshot.response, event.snapshot.updatedAt);
				}
				return;
			}
			this.unsupported = false;
			if (this.enabled) {
				this.restart();
			}
		});
		context.subscriptions.push(this.configListener, this.serviceListener, this.item);
		this.restart();
	}

	dispose(): void {
		this.stopTimer();
	}

	restart(): void {
		this.stopTimer();
		this.enabled = isBalanceStatusBarEnabled();
		if (!this.enabled) {
			this.item.hide();
			return;
		}
		void this.tick();
	}

	private stopTimer(): void {
		if (this.timer !== undefined) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
	}

	private scheduleNext(): void {
		this.stopTimer();
		this.timer = setTimeout(
			() => {
				this.timer = undefined;
				void this.tick();
			},
			Math.max(MIN_REFRESH_MINUTES, getBalanceRefreshIntervalMinutes()) * 60_000,
		);
	}

	private async tick(userInitiated = false): Promise<void> {
		if (this.inFlight || !this.enabled) {
			return;
		}
		this.inFlight = true;
		try {
			if (userInitiated) {
				this.showSpinner();
			}
			try {
				// A click is an explicit refresh: bypass the shared 60s cache.
				const snapshot = await getBalanceSnapshot({ force: userInitiated });
				this.render(snapshot.response, snapshot.updatedAt);
			} catch (error) {
				if (error instanceof MissingApiKeyError) {
					this.item.hide();
					return;
				}
				this.handleFailure(error);
			}
		} finally {
			this.inFlight = false;
			if (this.enabled && !this.unsupported) {
				this.scheduleNext();
			}
		}
	}

	private showSpinner(): void {
		this.item.text = this.lastBalanceText ? `$(sync~spin) ${this.lastBalanceText}` : '$(sync~spin)';
	}

	private render(response: DeepSeekBalanceResponse, updatedAt: string): void {
		this.lastBalanceText = formatBalanceParts(response);
		this.item.text = `$(credit-card) ${this.lastBalanceText}`;
		this.item.tooltip = buildTooltip(response, updatedAt);
		this.item.show();
	}

	private handleFailure(error: unknown): void {
		if (
			error instanceof BalanceError &&
			error.kind === 'http' &&
			(error.status === 404 || error.status === 405)
		) {
			// Third-party endpoints usually have no balance API; stop polling silently.
			this.unsupported = true;
			this.item.hide();
			logger.info('Balance status bar hidden: endpoint does not support GET /user/balance');
			return;
		}
		// Keep showing the last known balance; the tooltip's timestamp conveys staleness.
		logger.debug('Balance status bar refresh failed', error);
		if (this.lastBalanceText === undefined) {
			this.item.hide();
		}
	}

	/** Handle a status bar click: refresh now (spinner feedback) instead of opening the panel. */
	forceRefresh(): void {
		if (this.inFlight || !this.enabled) {
			return;
		}
		void this.tick(true);
	}
}

function formatBalanceParts(response: DeepSeekBalanceResponse): string {
	return response.balance_infos
		.map((info) => formatCurrencyAmount(info.currency, info.total_balance))
		.join(' · ');
}

function formatCurrencyAmount(currency: string, amount: string): string {
	const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
	return symbol ? `${symbol}${amount}` : `${currency} ${amount}`;
}

function buildTooltip(response: DeepSeekBalanceResponse, updatedAt: string): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.appendMarkdown(`**${t('balance.statusBar.tooltip.title')}**\n\n`);
	if (!response.is_available) {
		md.appendMarkdown(`⚠️ ${t('balance.panel.unavailable')}\n\n`);
	}
	for (const info of response.balance_infos) {
		md.appendMarkdown(
			`**${formatCurrencyAmount(info.currency, info.total_balance)}** — ` +
				`${t('balance.panel.granted')}: ${info.granted_balance} · ` +
				`${t('balance.panel.toppedUp')}: ${info.topped_up_balance}\n\n`,
		);
	}
	md.appendMarkdown(
		`_${t('balance.panel.updatedAt', updatedAt)} · ${t('balance.statusBar.clickHint')}_`,
	);
	return md;
}
