import {
	KeycloakRuntimeConfig,
	loadKeycloakConfig,
	parseOriginsEnv,
	parsePortEnv,
	readEnvOrDefault,
} from "@clinic/api-common";

export interface ApiRuntimeEnv {
	nodeEnv: string;
	port: number;
	corsOrigins: string[];
	keycloak: KeycloakRuntimeConfig;
}

let cachedEnv: ApiRuntimeEnv | undefined;

export function getApiRuntimeEnv(): ApiRuntimeEnv {
	if (cachedEnv) {
		return cachedEnv;
	}

	cachedEnv = {
		nodeEnv: readEnvOrDefault("NODE_ENV", "development"),
		port: parsePortEnv("PORT", 3004),
		corsOrigins: parseOriginsEnv("API_ADMIN_CORS_ORIGINS", "http://localhost:5176"),
		keycloak: loadKeycloakConfig("KEYCLOAK_ADMIN_PORTAL_CLIENT_ID"),
	};

	return cachedEnv;
}
