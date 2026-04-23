import { parseOriginsEnv, parsePortEnv, readEnvOrDefault } from "./env";
import { loadKeycloakConfig, type KeycloakRuntimeConfig } from "./keycloak";

export interface ApiRuntimeEnv {
	nodeEnv: string;
	port: number;
	corsOrigins: string[];
	keycloak: KeycloakRuntimeConfig;
}

export interface CreateApiRuntimeEnvOptions {
	/** Default port if the PORT env var is not set (e.g. 3001 for api-patient). */
	defaultPort: number;
	/** Env var name holding comma-separated CORS origins (e.g. "API_PATIENT_CORS_ORIGINS"). */
	corsEnvVar: string;
	/** Default CORS origin(s) used when the env var is unset (e.g. "http://localhost:5173"). */
	corsDefault: string;
	/** Env var holding the Keycloak audience / client id for this service. */
	clientIdEnvVar: string;
}

/**
 * Builds a memoized accessor for a service's runtime environment. Each API
 * service calls this once at module load and exposes the returned function
 * throughout its code base; the underlying config is resolved lazily on first
 * call and cached for subsequent invocations.
 */
export function createApiRuntimeEnv(options: CreateApiRuntimeEnvOptions): () => ApiRuntimeEnv {
	let cached: ApiRuntimeEnv | undefined;
	return function getApiRuntimeEnv(): ApiRuntimeEnv {
		if (cached) return cached;
		cached = {
			nodeEnv: readEnvOrDefault("NODE_ENV", "development"),
			port: parsePortEnv("PORT", options.defaultPort),
			corsOrigins: parseOriginsEnv(options.corsEnvVar, options.corsDefault),
			keycloak: loadKeycloakConfig(options.clientIdEnvVar),
		};
		return cached;
	};
}
