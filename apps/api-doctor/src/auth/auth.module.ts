import { ClinicAuthModule } from "@clinic/api-common";

import { getApiRuntimeEnv } from "../config/env";

export const AuthModule = ClinicAuthModule.forRoot({
	requiredRole: "doctor",
	keycloak: getApiRuntimeEnv().keycloak,
});
