import { createAppConfig } from "@clinic/portal-common";

export const appConfig = createAppConfig({
	env: import.meta.env,
	apiBaseUrlEnvVar: "VITE_ADMIN_API_BASE_URL",
	apiBaseUrlDefault: "http://localhost:3004/api",
	keycloakClientIdEnvVar: "VITE_ADMIN_KEYCLOAK_CLIENT_ID",
	keycloakClientIdDefault: "admin-portal-client",
});
