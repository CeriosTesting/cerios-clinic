function envOrDefault(name: string, fallback: string): string {
	const value = import.meta.env[name];
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	return fallback;
}

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const appConfig = {
	apiBaseUrl: trimTrailingSlash(envOrDefault("VITE_DOCTOR_API_BASE_URL", "http://localhost:3002/api")),
	keycloakUrl: trimTrailingSlash(envOrDefault("VITE_KEYCLOAK_URL", "http://localhost:8180")),
	keycloakRealm: envOrDefault("VITE_KEYCLOAK_REALM", "clinic"),
	keycloakClientId: envOrDefault("VITE_DOCTOR_KEYCLOAK_CLIENT_ID", "doctor-portal-client"),
} as const;
