import { createApi } from "@clinic/portal-common";

import { appConfig } from "./config";
import keycloak from "./keycloak";

const api = createApi({ baseUrl: appConfig.apiBaseUrl, keycloak });

export default api;
