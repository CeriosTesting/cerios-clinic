import axios from "axios";

import { appConfig } from "./config";
import keycloak from "./keycloak";

const api = axios.create({
	baseURL: appConfig.apiBaseUrl,
});

api.interceptors.request.use(async config => {
	if (keycloak.isTokenExpired(30)) {
		await keycloak.updateToken(30).catch(() => keycloak.login());
	}
	if (keycloak.token) {
		config.headers.Authorization = `Bearer ${keycloak.token}`;
	}
	return config;
});

export default api;
