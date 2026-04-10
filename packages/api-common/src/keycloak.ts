import { parseHttpUrlEnv, readEnvOrDefault, requireEnv } from "./env";

export interface KeycloakRuntimeConfig {
	url: string;
	realm: string;
	audience: string;
	adminClientId: string;
	adminClientSecret: string;
	issuer: string;
	jwksUri: string;
	tokenEndpoint: string;
	adminApiBaseUrl: string;
}

export function loadKeycloakConfig(audienceEnvVar: string): KeycloakRuntimeConfig {
	const url = parseHttpUrlEnv("KEYCLOAK_URL", "http://localhost:8080");
	const realm = readEnvOrDefault("KEYCLOAK_REALM", "clinic");
	const audience = requireEnv(audienceEnvVar);
	const adminClientId = readEnvOrDefault("KEYCLOAK_ADMIN_CLIENT_ID", "api-service-client");
	const adminClientSecret = requireEnv("KEYCLOAK_ADMIN_CLIENT_SECRET");

	const issuer = `${url}/realms/${realm}`;

	return {
		url,
		realm,
		audience,
		adminClientId,
		adminClientSecret,
		issuer,
		jwksUri: `${issuer}/protocol/openid-connect/certs`,
		tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
		adminApiBaseUrl: `${url}/admin/realms/${realm}`,
	};
}
