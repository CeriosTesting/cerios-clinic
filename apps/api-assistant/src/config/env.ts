import { createApiRuntimeEnv } from "@clinic/api-common";

export const getApiRuntimeEnv = createApiRuntimeEnv({
	defaultPort: 3003,
	corsEnvVar: "API_ASSISTANT_CORS_ORIGINS",
	corsDefault: "http://localhost:5175",
	clientIdEnvVar: "KEYCLOAK_ASSISTANT_CLIENT_ID",
});

export type { ApiRuntimeEnv } from "@clinic/api-common";
