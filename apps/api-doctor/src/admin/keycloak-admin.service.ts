import { Injectable } from "@nestjs/common";
import axios from "axios";

import { getApiRuntimeEnv } from "../config/env";

@Injectable()
export class KeycloakAdminService {
	private readonly baseUrl: string;
	private readonly realm: string;
	private readonly clientId: string;
	private readonly clientSecret: string;

	constructor() {
		const env = getApiRuntimeEnv();
		this.baseUrl = env.keycloak.url;
		this.realm = env.keycloak.realm;
		this.clientId = env.keycloak.adminClientId;
		this.clientSecret = env.keycloak.adminClientSecret;
	}

	private async getAdminToken(): Promise<string> {
		const params = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.clientId,
			client_secret: this.clientSecret,
		});
		const response = await axios.post(
			`${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
			params.toString(),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);
		return response.data.access_token as string;
	}

	async createUser(data: {
		email: string;
		firstName: string;
		lastName: string;
		password: string;
		roles: string[];
	}): Promise<string> {
		const token = await this.getAdminToken();
		const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

		const createResponse = await axios.post(
			`${this.baseUrl}/admin/realms/${this.realm}/users`,
			{
				username: data.email,
				email: data.email,
				firstName: data.firstName,
				lastName: data.lastName,
				enabled: true,
				emailVerified: true,
				credentials: [{ type: "password", value: data.password, temporary: false }],
			},
			{ headers }
		);

		const location: string = createResponse.headers["location"] as string;
		const keycloakId = location.split("/").pop() as string;

		// Assign realm roles
		const allRoles = await axios.get(`${this.baseUrl}/admin/realms/${this.realm}/roles`, { headers });
		const rolesToAssign = (allRoles.data as Array<{ name: string; id: string }>)
			.filter(r => data.roles.includes(r.name))
			.map(r => ({ id: r.id, name: r.name }));

		await axios.post(
			`${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`,
			rolesToAssign,
			{ headers }
		);

		return keycloakId;
	}

	async updateUser(keycloakId: string, data: { firstName?: string; lastName?: string }): Promise<void> {
		const token = await this.getAdminToken();
		await axios.put(
			`${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}`,
			{ firstName: data.firstName, lastName: data.lastName },
			{ headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
		);
	}

	async disableUser(keycloakId: string): Promise<void> {
		const token = await this.getAdminToken();
		await axios.put(
			`${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}`,
			{ enabled: false },
			{ headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
		);
	}
}
