import { createJwtStrategy, type KeycloakTokenPayload } from "@clinic/api-common";

import { getApiRuntimeEnv } from "../config/env";

export type { KeycloakTokenPayload };

export const JwtStrategy = createJwtStrategy({
	requiredRole: "admin",
	keycloak: getApiRuntimeEnv().keycloak,
});
