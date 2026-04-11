import { API_URL } from "@env";
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import EncryptedStorage from "react-native-encrypted-storage";

import { refreshTokens } from "../auth/keycloak";

const STORAGE_KEY = "cerios_auth_tokens";

interface StoredTokens {
	accessToken: string;
	refreshToken: string;
	accessTokenExpirationDate: string;
	idToken: string;
}

// Module-level token cache — avoids an EncryptedStorage (native bridge) call on
// every outgoing request. Updated by updateCachedToken() and cleared on sign-out.
let cachedAccessToken: string | null = null;

/**
 * Called by AuthContext after sign-in, token refresh, or sign-out so the cache
 * stays in sync without a storage read per request.
 */
export function updateCachedToken(token: string | null): void {
	cachedAccessToken = token;
}

const api: AxiosInstance = axios.create({
	baseURL: API_URL,
	timeout: 15_000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
	if (cachedAccessToken) {
		config.headers.Authorization = `Bearer ${cachedAccessToken}`;
	} else {
		// Fallback: read from storage on first request before cache is populated
		const raw = await EncryptedStorage.getItem(STORAGE_KEY);
		if (raw) {
			const tokens = JSON.parse(raw) as StoredTokens;
			cachedAccessToken = tokens.accessToken;
			config.headers.Authorization = `Bearer ${cachedAccessToken}`;
		}
	}
	return config;
});

let isRefreshing = false;
let failedQueue: Array<{
	resolve: (value: string) => void;
	reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
	for (const prom of failedQueue) {
		if (error) prom.reject(error);
		else prom.resolve(token!);
	}
	failedQueue = [];
}

api.interceptors.response.use(
	response => response,
	async error => {
		const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

		if (error.response?.status === 401 && !originalRequest._retry) {
			if (isRefreshing) {
				return new Promise<string>((resolve, reject) => {
					failedQueue.push({ resolve, reject });
				}).then(token => {
					originalRequest.headers.Authorization = `Bearer ${token}`;
					return api(originalRequest);
				});
			}

			originalRequest._retry = true;
			isRefreshing = true;

			try {
				const refreshed = await refreshTokens();
				if (!refreshed) return Promise.reject(error);
				updateCachedToken(refreshed.accessToken);
				processQueue(null, refreshed.accessToken);
				originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
				return api(originalRequest);
			} catch (refreshError) {
				processQueue(refreshError, null);
				return Promise.reject(refreshError);
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	}
);

export default api;
