import axios, { type AxiosInstance } from "axios";
import Keycloak from "keycloak-js";

export interface CreateApiOptions {
	baseUrl: string;
	keycloak: Keycloak;
	/** Seconds remaining on the access token that trigger a refresh (default 30). */
	minValiditySeconds?: number;
}

/**
 * Builds a shared axios client that:
 * 1. Prefixes requests with `baseUrl`.
 * 2. Before each request, if a token exists, proactively refreshes it when
 *    within `minValiditySeconds` of expiry (falling back to `login()` on failure).
 * 3. Attaches the current bearer token to `Authorization`.
 *
 * Matches the behavior of the previous per-portal api.ts files (patient-portal's
 * unconditional updateToken and doctor/assistant's isTokenExpired gate collapse
 * to the same outcome because updateToken is a no-op when the token is fresh).
 */
export function createApi(options: CreateApiOptions): AxiosInstance {
	const minValidity = options.minValiditySeconds ?? 30;
	const instance = axios.create({ baseURL: options.baseUrl });

	instance.interceptors.request.use(async config => {
		const kc = options.keycloak;
		if (kc.token) {
			if (kc.isTokenExpired(minValidity)) {
				await kc.updateToken(minValidity).catch(() => kc.login());
			}
			config.headers.Authorization = `Bearer ${kc.token}`;
		}
		return config;
	});

	return instance;
}
