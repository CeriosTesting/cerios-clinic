import { createAppConfig } from "@clinic/portal-common";

export const appConfig = createAppConfig({
	env: import.meta.env,
	apiBaseUrlEnvVar: "VITE_DOCTOR_API_BASE_URL",
	apiBaseUrlDefault: "http://localhost:3002/api",
	keycloakClientIdEnvVar: "VITE_DOCTOR_KEYCLOAK_CLIENT_ID",
	keycloakClientIdDefault: "doctor-portal-client",
});
