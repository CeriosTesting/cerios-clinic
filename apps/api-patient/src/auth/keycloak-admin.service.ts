import { readEnvOrDefault } from "@clinic/api-common";
import { Injectable, ConflictException, InternalServerErrorException, Logger } from "@nestjs/common";

import { getApiRuntimeEnv } from "../config/env";

@Injectable()
export class KeycloakAdminService {
	private readonly logger = new Logger(KeycloakAdminService.name);
	private readonly baseUrl: string;
	private readonly realm: string;
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly patientClientId: string;
	private readonly patientPortalUrl: string;

	constructor() {
		const env = getApiRuntimeEnv();
		this.baseUrl = env.keycloak.url;
		this.realm = env.keycloak.realm;
		this.clientId = env.keycloak.adminClientId;
		this.clientSecret = env.keycloak.adminClientSecret;
		this.patientClientId = env.keycloak.audience;
		this.patientPortalUrl = readEnvOrDefault("PATIENT_PORTAL_URL", "http://localhost:5173");
	}

	/**
	 * Logs a Keycloak failure server-side (endpoint, status, body) but throws a
	 * generic error to keep API responses opaque to clients.
	 */
	private async failKeycloak(context: string, endpoint: string, res: Response): Promise<never> {
		const body = await res.text().catch(() => "<unreadable>");
		this.logger.error(`[${context}] ${res.status} ${res.statusText} on ${endpoint} — body: ${body.slice(0, 500)}`);
		throw new InternalServerErrorException(`Failed to ${context}`);
	}

	private async getAdminToken(): Promise<string> {
		const endpoint = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
		const params = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.clientId,
			client_secret: this.clientSecret,
		});
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		if (!res.ok) {
			await this.failKeycloak("obtain admin token", endpoint, res);
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

		// Create the user — emailVerified is false so login is gated until the
		// user completes the VERIFY_EMAIL required action.
		const createEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/users`;
		const createRes = await fetch(createEndpoint, {
			method: "POST",
			headers,
			body: JSON.stringify({
				username: data.email,
				email: data.email,
				firstName: data.firstName,
				lastName: data.lastName,
				enabled: true,
				emailVerified: false,
				credentials: [{ type: "password", value: data.password, temporary: false }],
			}),
		});

		if (createRes.status === 409) {
			throw new ConflictException("Email already registered");
		}
		if (!createRes.ok) {
			await this.failKeycloak("create user in Keycloak", createEndpoint, createRes);
		}

		const location = createRes.headers.get("location") ?? "";
		const keycloakId = location.split("/").pop();
		if (!keycloakId) {
			this.logger.error(`[create user in Keycloak] Missing Location header on 201 response`);
			throw new InternalServerErrorException("Could not determine new user ID from Keycloak");
		}

		// Look up the 'patient' role
		const rolesEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/roles`;
		const rolesRes = await fetch(rolesEndpoint, { headers });
		if (!rolesRes.ok) {
			await this.failKeycloak("fetch realm roles from Keycloak", rolesEndpoint, rolesRes);
		}
		const allRoles = (await rolesRes.json()) as Array<{ name: string; id: string }>;
		const patientRole = allRoles.find(r => r.name === "patient");
		if (!patientRole) {
			this.logger.error(`[assign role] 'patient' realm role missing from Keycloak realm '${this.realm}'`);
			throw new InternalServerErrorException("patient role not found in Keycloak realm");
		}

		// Assign the 'patient' role
		const assignEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`;
		const assignRes = await fetch(assignEndpoint, {
			method: "POST",
			headers,
			body: JSON.stringify([{ id: patientRole.id, name: patientRole.name }]),
		});
		if (!assignRes.ok) {
			await this.failKeycloak("assign patient role in Keycloak", assignEndpoint, assignRes);
		}

		return keycloakId;
	}

	/**
	 * Triggers Keycloak to send a VERIFY_EMAIL action email to the user. The
	 * verification link returns the user to the patient portal on completion.
	 */
	async sendVerifyEmail(keycloakId: string): Promise<void> {
		const token = await this.getAdminToken();
		const params = new URLSearchParams({
			client_id: this.patientClientId,
			redirect_uri: this.patientPortalUrl,
		});
		const endpoint = `${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}/execute-actions-email?${params.toString()}`;
		const res = await fetch(endpoint, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(["VERIFY_EMAIL"]),
		});
		if (!res.ok) {
			await this.failKeycloak("send verification email", endpoint, res);
		}
	}

	/**
	 * Looks up a Keycloak user by email. Returns null if no user exists.
	 * Used by the resend-verification flow which must not leak whether an
	 * email is registered.
	 */
	async findUserByEmail(email: string): Promise<{ id: string; emailVerified: boolean } | null> {
		const token = await this.getAdminToken();
		const endpoint = `${this.baseUrl}/admin/realms/${this.realm}/users?email=${encodeURIComponent(email)}&exact=true`;
		const res = await fetch(endpoint, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			await this.failKeycloak("look up user by email", endpoint, res);
		}
		const users = (await res.json()) as Array<{ id: string; emailVerified?: boolean }>;
		if (users.length === 0) return null;
		return { id: users[0].id, emailVerified: users[0].emailVerified ?? false };
	}

	async disableUser(keycloakId: string): Promise<void> {
		const token = await this.getAdminToken();
		const endpoint = `${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}`;
		const res = await fetch(endpoint, {
			method: "PUT",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: false }),
		});
		if (!res.ok) {
			// Best-effort cleanup path — log only, don't throw over a failing rollback.
			const body = await res.text().catch(() => "<unreadable>");
			this.logger.warn(`[disable user] ${res.status} ${res.statusText} on ${endpoint} — body: ${body.slice(0, 500)}`);
		}
	}
}
