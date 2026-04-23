import { createApiRuntimeEnv } from "@clinic/api-common";

export const getApiRuntimeEnv = createApiRuntimeEnv({
	defaultPort: 3004,
	corsEnvVar: "API_ADMIN_CORS_ORIGINS",
	corsDefault: "http://localhost:5176",
	clientIdEnvVar: "KEYCLOAK_ADMIN_PORTAL_CLIENT_ID",
});

export type { ApiRuntimeEnv } from "@clinic/api-common";
