import Keycloak, { type KeycloakConfig } from "keycloak-js";

import type { PortalAppConfig } from "./config";

/**
 * Creates a Keycloak client configured from a portal's runtime config.
 * The returned instance is uninitialized; callers should invoke `init(...)` in their bootstrap.
 */
export function createKeycloak(appConfig: PortalAppConfig): Keycloak {
	const config: KeycloakConfig = {
		url: appConfig.keycloakUrl,
		realm: appConfig.keycloakRealm,
		clientId: appConfig.keycloakClientId,
	};
	return new Keycloak(config);
}
