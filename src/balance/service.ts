import vscode from 'vscode';
import { AuthManager } from '../auth';
import { getBaseUrl, getRequestHeaders } from '../config';
import { API_KEY_SECRET } from '../consts';
import { t } from '../i18n';
import { fetchBalance } from './client';
import type { DeepSeekBalanceResponse } from './types';

/** Shared cache lifetime; a force refresh (panel) always bypasses it. */
const BALANCE_CACHE_TTL_MS = 60_000;

/** Thrown when no API key is configured; callers decide how to surface it. */
export class MissingApiKeyError extends Error {
	constructor() {
		super(t('balance.error.notConfigured'));
		this.name = 'MissingApiKeyError';
	}
}

export interface BalanceSnapshot {
	response: DeepSeekBalanceResponse;
	baseUrl: string;
	updatedAt: string;
}

export type BalanceServiceEvent =
	| { type: 'updated'; snapshot: BalanceSnapshot }
	| { type: 'invalidated' };

interface CacheEntry {
	snapshot: BalanceSnapshot;
	fetchedAtMs: number;
}

class BalanceServiceImpl {
	private cache: CacheEntry | undefined;
	private inFlight: Promise<BalanceSnapshot> | undefined;
	private authManager: AuthManager | undefined;
	private generation = 0;
	private readonly changeListeners = new Set<(event: BalanceServiceEvent) => void>();

	/**
	 * Bind to the extension context once: enables credential/endpoint change
	 * tracking so cached results are invalidated when they stop being valid.
	 */
	attach(context: vscode.ExtensionContext): void {
		if (this.authManager) {
			return;
		}
		this.authManager = new AuthManager(context);
		const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
			if (
				event.affectsConfiguration('deepseek-copilot.baseUrl') ||
				event.affectsConfiguration('deepseek-copilot.requestHeaders')
			) {
				this.invalidate();
			}
		});
		const secretListener = context.secrets.onDidChange((event) => {
			if (event.key === API_KEY_SECRET) {
				this.invalidate();
			}
		});
		context.subscriptions.push(configListener, secretListener);
	}

	onDidChange(listener: (event: BalanceServiceEvent) => void): vscode.Disposable {
		this.changeListeners.add(listener);
		return {
			dispose: () => {
				this.changeListeners.delete(listener);
			},
		};
	}

	/** Drop the cache and notify listeners (for example, after an endpoint change). */
	invalidate(): void {
		this.generation++;
		this.cache = undefined;
		this.emit({ type: 'invalidated' });
	}

	/**
	 * Get the account balance, deduplicating concurrent requests and honoring
	 * a short shared cache. `force` bypasses the cache (panel refresh).
	 *
	 * An invalidate() while a request is in flight discards that stale result:
	 * it never updates the cache or notifies listeners, and this call refetches.
	 */
	async getBalance(options: { force?: boolean } = {}): Promise<BalanceSnapshot> {
		const generationAtStart = this.generation;
		const baseUrl = getBaseUrl();
		if (
			!options.force &&
			this.cache?.snapshot.baseUrl === baseUrl &&
			Date.now() - this.cache.fetchedAtMs < BALANCE_CACHE_TTL_MS
		) {
			return this.cache.snapshot;
		}
		this.inFlight ??= this.fetchSnapshot(baseUrl, generationAtStart).finally(() => {
			this.inFlight = undefined;
		});
		const snapshot = await this.inFlight;
		if (generationAtStart !== this.generation) {
			// The result belongs to a superseded endpoint or credential; refetch.
			return this.getBalance(options);
		}
		return snapshot;
	}

	private async fetchSnapshot(baseUrl: string, generation: number): Promise<BalanceSnapshot> {
		const apiKey = await this.authManager?.getApiKey();
		if (!apiKey) {
			throw new MissingApiKeyError();
		}
		const response = await fetchBalance({ apiKey, baseUrl, headers: getRequestHeaders() });
		const snapshot: BalanceSnapshot = {
			response,
			baseUrl,
			updatedAt: new Date().toLocaleTimeString(vscode.env.language),
		};
		// A stale generation's response must not update the cache or notify
		// listeners — the endpoint or credential changed mid-flight.
		if (generation === this.generation && baseUrl === getBaseUrl()) {
			this.cache = { snapshot, fetchedAtMs: Date.now() };
			this.emit({ type: 'updated', snapshot });
		}
		return snapshot;
	}

	private emit(event: BalanceServiceEvent): void {
		for (const listener of this.changeListeners) {
			listener(event);
		}
	}
}

const balanceService = new BalanceServiceImpl();

/** Bind the shared service to the extension context (idempotent). */
export function attachBalanceService(context: vscode.ExtensionContext): void {
	balanceService.attach(context);
}

export function getBalanceSnapshot(options: { force?: boolean } = {}): Promise<BalanceSnapshot> {
	return balanceService.getBalance(options);
}

export function onBalanceDidChange(
	listener: (event: BalanceServiceEvent) => void,
): vscode.Disposable {
	return balanceService.onDidChange(listener);
}
