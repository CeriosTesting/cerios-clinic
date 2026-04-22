import { readEnvOrDefault } from "@clinic/api-common";
import {
	Injectable,
	ConflictException,
	InternalServerErrorException,
	Logger,
	OnApplicationBootstrap,
} from "@nestjs/common";

import { getApiRuntimeEnv } from "../config/env";

/** realm-management client roles required by this service to create/manage patients
 * and keep critical realm flags (e.g. verifyEmail) in sync. */
const REQUIRED_REALM_MGMT_ROLES = [
	"manage-users",
	"view-users",
	"query-users",
	"view-clients",
	"manage-realm",
	"view-realm",
] as const;

@Injectable()
export class KeycloakAdminService implements OnApplicationBootstrap {
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
	 * Ensures the service account has the realm-management client roles required
	 * to create/manage patient users. This self-heals installations where the
	 * Keycloak realm was imported from an older `clinic-realm.json` that did not
	 * assign these roles (Keycloak skips re-import when the realm already exists).
	 *
	 * Idempotent and best-effort: any failure is logged but does not prevent
	 * app startup. The create-user flow will surface a clear 500 if roles are
	 * still missing when a patient tries to register.
	 */
	async onApplicationBootstrap(): Promise<void> {
		try {
			await this.ensureServiceAccountRoles();
		} catch (err) {
			this.logger.warn(
				`Could not verify/assign realm-management roles for service account on startup: ${(err as Error).message}`
			);
		}
		try {
			await this.ensureRealmVerifyEmail();
		} catch (err) {
			this.logger.warn(`Could not verify/enable realm verifyEmail flag on startup: ${(err as Error).message}`);
		}
	}

	/**
	 * Ensures the realm has `verifyEmail: true` so new users must verify their
	 * email before they can log in. Self-heals installations whose realm was
	 * imported from an older `clinic-realm.json` with the flag disabled
	 * (Keycloak skips re-import once the realm exists in the database).
	 *
	 * Idempotent and best-effort: any failure is logged but does not prevent
	 * app startup.
	 */
	private async ensureRealmVerifyEmail(): Promise<void> {
		const token = await this.getAdminToken();
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
		const realmEndpoint = `${this.baseUrl}/admin/realms/${this.realm}`;

		const getRes = await fetch(realmEndpoint, { headers });
		if (!getRes.ok) {
			await this.failKeycloak("read realm configuration", realmEndpoint, getRes);
		}
		const realm = (await getRes.json()) as { verifyEmail?: boolean };
		if (realm.verifyEmail === true) {
			this.logger.log(`Realm '${this.realm}' already enforces email verification.`);
			return;
		}

		const putRes = await fetch(realmEndpoint, {
			method: "PUT",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ ...realm, verifyEmail: true }),
		});
		if (!putRes.ok) {
			await this.failKeycloak("enable verifyEmail on realm", realmEndpoint, putRes);
		}
		this.logger.log(`Self-healed realm '${this.realm}': set verifyEmail = true.`);
	}

	private async ensureServiceAccountRoles(): Promise<void> {
		const token = await this.getAdminToken();
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

		// 1. Find the service-account user for this client.
		const saUsername = `service-account-${this.clientId}`;
		const usersEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/users?username=${encodeURIComponent(saUsername)}&exact=true`;
		const usersRes = await fetch(usersEndpoint, { headers });
		if (!usersRes.ok) {
			await this.failKeycloak("look up service account user", usersEndpoint, usersRes);
		}
		const users = (await usersRes.json()) as Array<{ id: string }>;
		if (users.length === 0) {
			this.logger.warn(
				`Service account user '${saUsername}' not found; skipping role self-heal. ` +
					`Check that client '${this.clientId}' has service accounts enabled.`
			);
			return;
		}
		const userId = users[0].id;

		// 2. Find the realm-management client UUID.
		const clientsEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/clients?clientId=realm-management`;
		const clientsRes = await fetch(clientsEndpoint, { headers });
		if (!clientsRes.ok) {
			await this.failKeycloak("look up realm-management client", clientsEndpoint, clientsRes);
		}
		const clients = (await clientsRes.json()) as Array<{ id: string }>;
		if (clients.length === 0) {
			this.logger.warn("realm-management client not found; skipping role self-heal.");
			return;
		}
		const rmClientId = clients[0].id;

		// 3. Get the roles currently assigned and available for this SA.
		const mappingsEndpoint = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/clients/${rmClientId}`;
		const availableEndpoint = `${mappingsEndpoint}/available`;

		const assignedRes = await fetch(mappingsEndpoint, { headers });
		if (!assignedRes.ok) {
			await this.failKeycloak("read assigned realm-management roles", mappingsEndpoint, assignedRes);
		}
		const assigned = (await assignedRes.json()) as Array<{ name: string }>;
		const assignedNames = new Set(assigned.map(r => r.name));

		const missing = REQUIRED_REALM_MGMT_ROLES.filter(r => !assignedNames.has(r));
		if (missing.length === 0) {
			this.logger.log(`Service account '${saUsername}' already has required realm-management roles.`);
			return;
		}

		const availableRes = await fetch(availableEndpoint, { headers });
		if (!availableRes.ok) {
			await this.failKeycloak("read available realm-management roles", availableEndpoint, availableRes);
		}
		const available = (await availableRes.json()) as Array<{ id: string; name: string }>;
		const toAssign = available.filter(r => missing.includes(r.name as (typeof REQUIRED_REALM_MGMT_ROLES)[number]));

		if (toAssign.length === 0) {
			this.logger.warn(
				`Missing realm-management roles [${missing.join(", ")}] but none are available to assign on realm '${this.realm}'.`
			);
			return;
		}

		const assignRes = await fetch(mappingsEndpoint, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify(toAssign.map(r => ({ id: r.id, name: r.name }))),
		});
		if (!assignRes.ok) {
			await this.failKeycloak("assign realm-management roles to service account", mappingsEndpoint, assignRes);
		}

		this.logger.log(
			`Self-healed service account '${saUsername}': assigned realm-management roles [${toAssign.map(r => r.name).join(", ")}].`
		);
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
		if (createRes.status === 403) {
			this.logger.error(
				`[create user in Keycloak] 403 Forbidden — service account '${`service-account-${this.clientId}`}' ` +
					`is missing realm-management roles on realm '${this.realm}'. ` +
					`Required: ${REQUIRED_REALM_MGMT_ROLES.join(", ")}. ` +
					`Normally assigned automatically on startup; if this persists the startup self-heal also lacked permission.`
			);
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
	 * Triggers Keycloak to send a "Verify email" activation email to the user.
	 * Uses the dedicated `send-verify-email` endpoint (which renders the
	 * "Verify email" template) rather than `execute-actions-email` (which
	 * renders the generic "Update your account" template). The verification
	 * link returns the user to the patient portal on completion.
	 */
	async sendVerifyEmail(keycloakId: string): Promise<void> {
		const token = await this.getAdminToken();
		const params = new URLSearchParams({
			client_id: this.patientClientId,
			redirect_uri: this.patientPortalUrl,
		});
		const endpoint = `${this.baseUrl}/admin/realms/${this.realm}/users/${keycloakId}/send-verify-email?${params.toString()}`;
		const res = await fetch(endpoint, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
			},
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
