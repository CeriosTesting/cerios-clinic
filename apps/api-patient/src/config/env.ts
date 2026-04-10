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
		port: parsePortEnv("PORT", 3001),
		corsOrigins: parseOriginsEnv("API_PATIENT_CORS_ORIGINS", "http://localhost:5173"),
		keycloak: loadKeycloakConfig("KEYCLOAK_PATIENT_CLIENT_ID"),
	};

	return cachedEnv;
}
