export const OFFICIAL_DEEPSEEK_API_HOST = 'api.deepseek.com';

export function isOfficialDeepSeekBaseUrl(baseUrl: string): boolean {
	try {
		return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_DEEPSEEK_API_HOST;
	} catch {
		return false;
	}
}

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/u, '');
}

/**
 * Shared rule for DeepSeek endpoints appended to a configured base URL.
 *
 * The official host serves `/beta` and `/v1` alongside the root, so its path
 * segment is ignored (endpoints are appended to the origin). A trailing `/v1`
 * on custom base URLs is stripped so the documented path is appended at the
 * service root.
 */
export function buildEndpointUrl(baseUrl: string, path: string): string {
	const normalized = normalizeBaseUrl(baseUrl);
	if (isOfficialDeepSeekBaseUrl(normalized)) {
		return `${new URL(normalized).origin}${path}`;
	}
	let base = normalized;
	if (base.toLowerCase().endsWith('/v1')) {
		base = normalizeBaseUrl(base.slice(0, -3));
	}
	return `${base}${path}`;
}

/** Tool-style endpoints: POST /v1/tools/{search|fetch|ocr}. */
export function buildToolEndpoint(baseUrl: string, toolPath: 'search' | 'fetch' | 'ocr'): string {
	return buildEndpointUrl(baseUrl, `/v1/tools/${toolPath}`);
}

/** Account endpoints documented at the service root, for example GET /user/balance. */
export function buildAccountEndpoint(baseUrl: string, path: string): string {
	return buildEndpointUrl(baseUrl, path);
}
