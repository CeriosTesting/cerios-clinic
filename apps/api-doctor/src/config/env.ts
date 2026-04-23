import { createApiRuntimeEnv } from "@clinic/api-common";

export const getApiRuntimeEnv = createApiRuntimeEnv({
	defaultPort: 3002,
	corsEnvVar: "API_DOCTOR_CORS_ORIGINS",
	corsDefault: "http://localhost:5174",
	clientIdEnvVar: "KEYCLOAK_DOCTOR_CLIENT_ID",
});

export type { ApiRuntimeEnv } from "@clinic/api-common";
