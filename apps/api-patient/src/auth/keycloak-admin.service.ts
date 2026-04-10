import { Injectable, ConflictException, InternalServerErrorException } from "@nestjs/common";

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
		const res = await fetch(`${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		if (!res.ok) {
			throw new InternalServerErrorException("Could not obtain Keycloak admin token");
		}
		const data = (await res.json()) as { access_token: string };
		return data.access_token;
	}

	async createPatient(data: { email: string; firstName: string; lastName: string; password: string }): Promise<string> {
		const token = await this.getAdminToken();
		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		// Create the user
		const createRes = await fetch(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				username: data.email,
				email: data.email,
				firstName: data.firstName,
				lastName: data.lastName,
				enabled: true,
				emailVerified: true,
				credentials: [{ type: "password", value: data.password, temporary: false }],
			}),
		});

		if (createRes.status === 409) {
			throw new ConflictException("Email already registered");
		}
		if (!createRes.ok) {
			throw new InternalServerErrorException("Failed to create user in Keycloak");
		}

		const location = createRes.headers.get("location") ?? "";
		const keycloakId = location.split("/").pop();
		if (!keycloakId) {
			throw new InternalServerErrorException("Could not determine new user ID from Keycloak");
		}

		// Look up the 'patient' role
		const rolesRes = await fetch(`${this.baseUrl}/admin/realms/${this.realm}/roles`, { headers });
		if (!rolesRes.ok) {
			throw new InternalServerErrorException("Failed to fetch realm roles from Keycloak");
		}
		const allRoles = (await rolesRes.json()) as Array<{ name: string; id: string }>;
		const patientRole = allRoles.find(r => r.name === "patient");
		if (!patientRole) {
			throw new InternalServerErrorException("patient role not found in Keycloak realm");
		}

		// Assign the 'patient' role
		const assignRes = await fetch(
			`${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`,
			{
				method: "POST",
				headers,
				body: JSON.stringify([{ id: patientRole.id, name: patientRole.name }]),
			}
		);
		if (!assignRes.ok) {
			throw new InternalServerErrorException("Failed to assign patient role in Keycloak");
		}

		return keycloakId;
	}
}
