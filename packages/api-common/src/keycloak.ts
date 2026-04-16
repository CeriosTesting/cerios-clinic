import { parseHttpUrlEnv, readEnvOrDefault, requireEnv } from "./env";

export interface KeycloakRuntimeConfig {
	url: string;
	realm: string;
	audience: string;
	adminClientId: string;
	adminClientSecret: string;
	issuer: string | string[];
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

	// Android emulators reach the host via 10.0.2.2 instead of localhost,
	// producing tokens with a different issuer. Accept both so mobile tokens
	// are validated correctly during development.
	const issuers: string[] = [issuer];
	if (url.includes("localhost")) {
		issuers.push(issuer.replace("localhost", "10.0.2.2"));
	}

	// When the API runs inside Docker it reaches Keycloak via an internal
	// hostname (e.g. http://keycloak:8080), but the browser obtains tokens
	// from the public URL (http://localhost:8080). Accept the public issuer
	// so those tokens pass validation.
	const publicUrl = readEnvOrDefault("KEYCLOAK_PUBLIC_URL", "");
	if (publicUrl && publicUrl !== url) {
		const publicIssuer = `${publicUrl}/realms/${realm}`;
		issuers.push(publicIssuer);
		// Android emulators reach the host via 10.0.2.2 instead of localhost
		if (publicUrl.includes("localhost")) {
			issuers.push(publicIssuer.replace("localhost", "10.0.2.2"));
		}
	}

	return {
		url,
		realm,
		audience,
		adminClientId,
		adminClientSecret,
		issuer: issuers.length === 1 ? issuers[0] : issuers,
		jwksUri: `${issuer}/protocol/openid-connect/certs`,
		tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
		adminApiBaseUrl: `${url}/admin/realms/${realm}`,
	};
}
