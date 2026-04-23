import { createApi } from "@clinic/portal-common";

import { appConfig } from "./config";
import keycloak from "./keycloak";

const api = createApi({ baseUrl: appConfig.apiBaseUrl, keycloak });

export function getPatient(userId: string): ReturnType<typeof api.get> {
	return api.get(`/patients/${userId}`);
}

export function uploadPatientPhoto(userId: string, formData: FormData): ReturnType<typeof api.patch> {
	return api.patch(`/patients/${userId}/photo`, formData);
}

export default api;
