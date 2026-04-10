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

export function getPatient(userId: string): ReturnType<typeof api.get> {
	return api.get(`/patients/${userId}`);
}

export function uploadPatientPhoto(userId: string, formData: FormData): ReturnType<typeof api.patch> {
	return api.patch(`/patients/${userId}/photo`, formData);
}

export default api;
