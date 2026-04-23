import { createAppConfig } from "@clinic/portal-common";

export const appConfig = createAppConfig({
	env: import.meta.env,
	apiBaseUrlEnvVar: "VITE_ASSISTANT_API_BASE_URL",
	apiBaseUrlDefault: "http://localhost:3003/api",
	keycloakClientIdEnvVar: "VITE_ASSISTANT_KEYCLOAK_CLIENT_ID",
	keycloakClientIdDefault: "assistant-portal-client",
});
