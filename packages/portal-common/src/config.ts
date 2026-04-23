export function envOrDefault(env: ImportMetaEnv | Record<string, unknown>, name: string, fallback: string): string {
	const value = (env as Record<string, unknown>)[name];
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	return fallback;
}

export function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export interface PortalAppConfig {
	apiBaseUrl: string;
	keycloakUrl: string;
	keycloakRealm: string;
	keycloakClientId: string;
}

export interface CreateAppConfigOptions {
	/** Vite `import.meta.env` — pass directly from the caller to preserve static replacement. */
	env: ImportMetaEnv | Record<string, unknown>;
	apiBaseUrlEnvVar: string;
	apiBaseUrlDefault: string;
	keycloakClientIdEnvVar: string;
	keycloakClientIdDefault: string;
	/** Optional override for the `VITE_KEYCLOAK_URL` env var name (defaults to VITE_KEYCLOAK_URL). */
	keycloakUrlEnvVar?: string;
	keycloakUrlDefault?: string;
	keycloakRealmEnvVar?: string;
	keycloakRealmDefault?: string;
}

/**
 * Builds the standard per-portal runtime config from Vite env vars with sensible defaults.
 * All four portals share the same shape; only the env var names and defaults differ.
 */
export function createAppConfig(options: CreateAppConfigOptions): PortalAppConfig {
	return {
		apiBaseUrl: trimTrailingSlash(envOrDefault(options.env, options.apiBaseUrlEnvVar, options.apiBaseUrlDefault)),
		keycloakUrl: trimTrailingSlash(
			envOrDefault(
				options.env,
				options.keycloakUrlEnvVar ?? "VITE_KEYCLOAK_URL",
				options.keycloakUrlDefault ?? "http://localhost:8180"
			)
		),
		keycloakRealm: envOrDefault(
			options.env,
			options.keycloakRealmEnvVar ?? "VITE_KEYCLOAK_REALM",
			options.keycloakRealmDefault ?? "clinic"
		),
		keycloakClientId: envOrDefault(options.env, options.keycloakClientIdEnvVar, options.keycloakClientIdDefault),
	};
}

// Vite ambient type fallback so this package compiles without depending on vite/client in devDeps.
interface ImportMetaEnv {
	readonly [key: string]: string | boolean | undefined;
}
