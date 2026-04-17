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
		port: parsePortEnv("PORT", 3002),
		corsOrigins: parseOriginsEnv("API_DOCTOR_CORS_ORIGINS", "http://localhost:5174"),
		keycloak: loadKeycloakConfig("KEYCLOAK_DOCTOR_CLIENT_ID"),
	};

	return cachedEnv;
}
