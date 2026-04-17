import Keycloak from "keycloak-js";

import { appConfig } from "./config";

const keycloak = new Keycloak({
	url: appConfig.keycloakUrl,
	realm: appConfig.keycloakRealm,
	clientId: appConfig.keycloakClientId,
});

export default keycloak;
