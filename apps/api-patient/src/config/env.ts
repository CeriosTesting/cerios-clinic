import { createApiRuntimeEnv } from "@clinic/api-common";

export const getApiRuntimeEnv = createApiRuntimeEnv({
	defaultPort: 3001,
	corsEnvVar: "API_PATIENT_CORS_ORIGINS",
	corsDefault: "http://localhost:5173",
	clientIdEnvVar: "KEYCLOAK_PATIENT_CLIENT_ID",
});

export type { ApiRuntimeEnv } from "@clinic/api-common";
