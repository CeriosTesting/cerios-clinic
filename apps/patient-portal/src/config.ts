import { createAppConfig } from "@clinic/portal-common";

export const appConfig = createAppConfig({
	env: import.meta.env,
	apiBaseUrlEnvVar: "VITE_PATIENT_API_BASE_URL",
	apiBaseUrlDefault: "http://localhost:3001/api",
	keycloakClientIdEnvVar: "VITE_PATIENT_KEYCLOAK_CLIENT_ID",
	keycloakClientIdDefault: "patient-portal-client",
});
