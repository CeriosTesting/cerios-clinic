import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import api, { updateCachedToken } from "../api/client";

import { signIn, signOut, getStoredTokens, refreshTokens, isTokenExpiringSoon, parseAccessToken } from "./keycloak";

interface AuthUser {
	sub: string;
	email: string;
	given_name: string;
	family_name: string;
}

interface AuthContextValue {
	user: AuthUser | null;
	isLoading: boolean;
	login: () => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const appState = useRef<AppStateStatus>(AppState.currentState);
	// Guards against two simultaneous proactive refresh calls (e.g. AppState fires twice)
	const isProactiveRefreshing = useRef(false);

	const applyTokens = useCallback((accessToken: string) => {
		updateCachedToken(accessToken);
		const claims = parseAccessToken(accessToken) as Record<string, string>;
		setUser({
			sub: claims.sub ?? "",
			email: claims.email ?? "",
			given_name: claims.given_name ?? "",
			family_name: claims.family_name ?? "",
		});
	}, []);

	// Restore session on mount
	useEffect(() => {
		async function restore(): Promise<void> {
			try {
				const stored = await getStoredTokens();
				if (!stored) return;
				if (await isTokenExpiringSoon(stored)) {
					const refreshed = await refreshTokens();
					if (refreshed) applyTokens(refreshed.accessToken);
				} else {
					applyTokens(stored.accessToken);
				}
			} catch {
				// Session expired or invalid — start fresh
			} finally {
				setIsLoading(false);
			}
		}
		void restore();
	}, [applyTokens]);

	// Refresh token when app returns to foreground
	useEffect(() => {
		const handleForeground = async (next: AppStateStatus): Promise<void> => {
			if (appState.current.match(/inactive|background/) && next === "active") {
				if (isProactiveRefreshing.current) return;
				const stored = await getStoredTokens();
				if (stored && (await isTokenExpiringSoon(stored))) {
					isProactiveRefreshing.current = true;
					try {
						// Retry once on transient network failure before logging out
						const refreshed = await refreshTokens().catch(async () => {
							return refreshTokens().catch(() => null);
						});
						if (refreshed) {
							applyTokens(refreshed.accessToken);
						} else {
							updateCachedToken(null);
							setUser(null);
						}
					} finally {
						isProactiveRefreshing.current = false;
					}
				}
			}
			appState.current = next;
		};
		const subscription = AppState.addEventListener("change", (next: AppStateStatus): void => {
			void handleForeground(next);
		});
		return (): void => subscription.remove();
	}, [applyTokens]);

	const login = useCallback(async () => {
		const result = await signIn();
		applyTokens(result.accessToken);
		// Sync Keycloak identity to the patient DB — fire-and-forget, idempotent on the server
		const claims = parseAccessToken(result.accessToken) as Record<string, string>;
		api
			.post("/auth/sync", {
				keycloakId: claims.sub,
				email: claims.email,
				firstName: claims.given_name,
				lastName: claims.family_name,
			})
			.catch(() => undefined);
	}, [applyTokens]);

	const logout = useCallback(async () => {
		await signOut();
		updateCachedToken(null);
		setUser(null);
	}, []);

	return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
	return ctx;
}
