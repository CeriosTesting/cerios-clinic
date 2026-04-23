import { createKeycloak } from "@clinic/portal-common";

import { appConfig } from "./config";

const keycloak = createKeycloak(appConfig);

export default keycloak;
