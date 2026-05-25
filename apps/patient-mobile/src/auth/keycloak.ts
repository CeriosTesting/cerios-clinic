import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } from "@env";
import EncryptedStorage from "react-native-encrypted-storage";

const STORAGE_KEY = "cerios_auth_tokens";

const realmBaseUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
const oidcBaseUrl = `${realmBaseUrl}/protocol/openid-connect`;
const tokenEndpoint = `${oidcBaseUrl}/token`;
const logoutEndpoint = `${oidcBaseUrl}/logout`;
const revocationEndpoint = `${oidcBaseUrl}/revoke`;

const SCOPES = "openid profile email roles";

export interface StoredTokens {
	accessToken: string;
	refreshToken: string;
	accessTokenExpirationDate: string;
	idToken: string;
}

interface KeycloakTokenResponse {
	access_token: string;
	refresh_token: string;
	id_token?: string;
	expires_in: number;
	token_type: string;
}

interface KeycloakErrorResponse {
	error?: string;
	error_description?: string;
}

/** Thrown by `signInWithPassword` for any non-2xx response from the token endpoint. */
export class AuthError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "AuthError";
	}
}

function encodeForm(params: Record<string, string>): string {
	return Object.entries(params)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join("&");
}

async function postForm<T>(url: string, params: Record<string, string>): Promise<T> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: encodeForm(params),
	});
	const text = await response.text();
	const data = text ? (JSON.parse(text) as T & KeycloakErrorResponse) : ({} as T & KeycloakErrorResponse);
	if (!response.ok) {
		const err = data as KeycloakErrorResponse;
		throw new AuthError(
			err.error ?? `http_${response.status}`,
			err.error_description ?? `Request failed (${response.status})`
		);
	}
	return data;
}

function toStoredTokens(result: KeycloakTokenResponse, previous?: StoredTokens | null): StoredTokens {
	const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
	return {
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		accessTokenExpirationDate: expiresAt,
		idToken: result.id_token ?? previous?.idToken ?? "",
	};
}

export async function signInWithPassword(username: string, password: string): Promise<StoredTokens> {
	let result: KeycloakTokenResponse;
	try {
		result = await postForm<KeycloakTokenResponse>(tokenEndpoint, {
			grant_type: "password",
			client_id: KEYCLOAK_CLIENT_ID,
			username,
			password,
			scope: SCOPES,
		});
	} catch (e) {
		if (e instanceof AuthError) {
			if (e.code === "invalid_grant") {
				throw new AuthError(e.code, "Invalid username or password.");
			}
			throw e;
		}
		throw new AuthError("network_error", "Could not reach the server. Check your connection and try again.");
	}
	const stored = toStoredTokens(result);
	await storeTokens(stored);
	return stored;
}

export async function refreshTokens(): Promise<StoredTokens | null> {
	const stored = await getStoredTokens();
	if (!stored?.refreshToken) return null;

	const result = await postForm<KeycloakTokenResponse>(tokenEndpoint, {
		grant_type: "refresh_token",
		client_id: KEYCLOAK_CLIENT_ID,
		refresh_token: stored.refreshToken,
	});
	const updated = toStoredTokens(result, stored);
	await storeTokens(updated);
	return updated;
}

export async function signOut(): Promise<void> {
	const stored = await getStoredTokens();
	if (stored?.refreshToken) {
		// End the SSO session server-side
		await postForm(logoutEndpoint, {
			client_id: KEYCLOAK_CLIENT_ID,
			refresh_token: stored.refreshToken,
		}).catch(() => undefined);
		// Best-effort revoke of the refresh token
		await postForm(revocationEndpoint, {
			client_id: KEYCLOAK_CLIENT_ID,
			token: stored.refreshToken,
			token_type_hint: "refresh_token",
		}).catch(() => undefined);
	}
	await clearTokens();
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
	const raw = await EncryptedStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	return JSON.parse(raw) as StoredTokens;
}

export async function isTokenExpiringSoon(stored?: StoredTokens | null): Promise<boolean> {
	const tokens = stored !== undefined ? stored : await getStoredTokens();
	if (!tokens) return true;
	const exp = new Date(tokens.accessTokenExpirationDate).getTime();
	return Date.now() > exp - 30_000; // refresh if expiring in <30 seconds
}

async function storeTokens(tokens: StoredTokens): Promise<void> {
	await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

async function clearTokens(): Promise<void> {
	await EncryptedStorage.removeItem(STORAGE_KEY);
}

export function parseAccessToken(accessToken: string): Record<string, unknown> {
	const payload = accessToken.split(".")[1];
	if (!payload) return {};
	// Convert Base64url → Base64 and add padding to a multiple of 4
	const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	const decoded = atob(padded);
	return JSON.parse(decoded) as Record<string, unknown>;
}
