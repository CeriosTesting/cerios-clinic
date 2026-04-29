import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } from "@env";
import { authorize, logout as appAuthLogout, refresh, revoke, type AuthorizeResult } from "react-native-app-auth";
import EncryptedStorage from "react-native-encrypted-storage";

const STORAGE_KEY = "cerios_auth_tokens";

const realmBaseUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
const oidcBaseUrl = `${realmBaseUrl}/protocol/openid-connect`;

export interface StoredTokens {
	accessToken: string;
	refreshToken: string;
	accessTokenExpirationDate: string;
	idToken: string;
}

const config = {
	issuer: realmBaseUrl,
	// Avoid relying on discovery metadata hostnames (often localhost in local
	// Docker setups), which are unreachable from Android emulators/devices.
	serviceConfiguration: {
		authorizationEndpoint: `${oidcBaseUrl}/auth`,
		tokenEndpoint: `${oidcBaseUrl}/token`,
		revocationEndpoint: `${oidcBaseUrl}/revoke`,
		endSessionEndpoint: `${oidcBaseUrl}/logout`,
	},
	clientId: KEYCLOAK_CLIENT_ID,
	redirectUrl: "com.cerios.patient://oauth2redirect",
	scopes: ["openid", "profile", "email", "roles"],
	dangerouslyAllowInsecureHttpRequests: KEYCLOAK_URL.startsWith("http://"),
	additionalParameters: {},
};

export async function signIn(): Promise<AuthorizeResult> {
	const result = await authorize(config);
	await storeTokens({
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		accessTokenExpirationDate: result.accessTokenExpirationDate,
		idToken: result.idToken,
	});
	return result;
}

export async function refreshTokens(): Promise<StoredTokens | null> {
	const stored = await getStoredTokens();
	if (!stored?.refreshToken) return null;

	const result = await refresh(config, { refreshToken: stored.refreshToken });
	const updated: StoredTokens = {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken ?? stored.refreshToken,
		accessTokenExpirationDate: result.accessTokenExpirationDate,
		idToken: result.idToken ?? stored.idToken,
	};
	await storeTokens(updated);
	return updated;
}

export async function signOut(): Promise<void> {
	const stored = await getStoredTokens();
	if (stored?.idToken) {
		await appAuthLogout(config, {
			idToken: stored.idToken,
			postLogoutRedirectUrl: config.redirectUrl,
		}).catch(() => undefined);
	}
	if (stored?.accessToken) {
		await revoke(config, { tokenToRevoke: stored.accessToken, sendClientId: true }).catch(() => undefined);
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
