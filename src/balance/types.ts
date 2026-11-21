/**
 * Types for the DeepSeek account balance API (GET /user/balance).
 */

/** One balance entry per billing currency. */
export interface DeepSeekBalanceInfo {
	currency: string;
	total_balance: string;
	granted_balance: string;
	topped_up_balance: string;
}

/** Response of GET /user/balance. */
export interface DeepSeekBalanceResponse {
	is_available: boolean;
	balance_infos: DeepSeekBalanceInfo[];
}

export type BalanceErrorKind =
	| 'http'
	| 'network'
	| 'timeout'
	| 'cancelled'
	| 'invalid-response'
	| 'unknown';

/** Balance API failure carrying a localized, panel-ready message. */
export class BalanceError extends Error {
	readonly kind: BalanceErrorKind;
	readonly status?: number;

	constructor(kind: BalanceErrorKind, message: string, status?: number) {
		super(message);
		this.name = 'BalanceError';
		this.kind = kind;
		this.status = status;
	}
}

/** Snapshot rendered by the balance panel. */
export type BalancePanelState =
	| { type: 'loading' }
	| {
			type: 'data';
			isAvailable: boolean;
			balances: Array<{
				currency: string;
				total: string;
				granted: string;
				topUp: string;
			}>;
			baseUrl: string;
			updatedAt: string;
	  }
	| { type: 'error'; message: string; missingApiKey?: boolean };

/** Messages the balance panel webview sends back to the host. */
export type BalancePanelCommand = 'refresh' | 'setApiKey' | 'openUsage';
