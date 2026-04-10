import fs from "fs";
import path from "path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? "clinic";
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER ?? "admin";
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin_secret";
const SEED_STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? "Clinic1234!";
const SEED_PATIENT_PASSWORD = process.env.SEED_PATIENT_PASSWORD ?? "Patient1234!";

async function getAdminToken(): Promise<string> {
	const res = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=password&client_id=admin-cli&username=${KEYCLOAK_ADMIN_USER}&password=${KEYCLOAK_ADMIN_PASSWORD}`,
	});
	if (!res.ok) throw new Error(`Keycloak admin login failed: ${res.statusText}`);
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

async function upsertKeycloakUser(
	token: string,
	user: { email: string; firstName: string; lastName: string },
	password: string = SEED_STAFF_PASSWORD
): Promise<string> {
	const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
	const base = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}`;

	// Check if user already exists
	const searchRes = await fetch(`${base}/users?email=${encodeURIComponent(user.email)}&exact=true`, { headers });
	const existing = (await searchRes.json()) as Array<{ id: string }>;
	if (existing.length > 0) return existing[0].id;

	// Create new user
	const createRes = await fetch(`${base}/users`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			username: user.email,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			enabled: true,
			emailVerified: true,
			credentials: [{ type: "password", value: password, temporary: false }],
		}),
	});
	if (!createRes.ok) throw new Error(`Failed to create ${user.email}: ${await createRes.text()}`);

	// Keycloak returns the new ID in the Location header
	const location = createRes.headers.get("location") ?? "";
	const id = location.split("/").pop()!;
	return id;
}

async function assignRole(token: string, userId: string, roleName: string): Promise<void> {
	const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
	const base = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}`;
	const roleRes = await fetch(`${base}/roles/${roleName}`, { headers });
	const role = await roleRes.json();
	await fetch(`${base}/users/${userId}/role-mappings/realm`, {
		method: "POST",
		headers,
		body: JSON.stringify([role]),
	});
}

async function main(): Promise<void> {
	console.log("🌱 Seeding database...");

	// Sync Keycloak staff accounts first so IDs are always correct
	let kcToken: string | null = null;
	try {
		kcToken = await getAdminToken();
		console.log("🔑 Keycloak admin token obtained");
	} catch {
		console.warn("⚠️  Keycloak not reachable — skipping Keycloak sync. DB will use placeholder IDs.");
	}

	const staffUsers = [
		{
			email: "dr.smith@clinic.local",
			firstName: "James",
			lastName: "Smith",
			role: "doctor" as const,
			doctorData: { specialization: "General Practice", licenseNumber: "GP-001-2024" },
		},
		{
			email: "dr.johnson@clinic.local",
			firstName: "Sarah",
			lastName: "Johnson",
			role: "doctor" as const,
			doctorData: { specialization: "Cardiology", licenseNumber: "CARD-002-2024" },
		},
		{
			email: "dr.williams@clinic.local",
			firstName: "Michael",
			lastName: "Williams",
			role: "doctor" as const,
			doctorData: { specialization: "Neurology", licenseNumber: "NEUR-003-2024" },
		},
		{
			email: "assistant.brown@clinic.local",
			firstName: "Emily",
			lastName: "Brown",
			role: "assistant" as const,
			assistantData: { department: "Reception" },
		},
		{
			email: "assistant.davis@clinic.local",
			firstName: "Robert",
			lastName: "Davis",
			role: "assistant" as const,
			assistantData: { department: "Cardiology Wing" },
		},
		{
			email: "assistant.miller@clinic.local",
			firstName: "Lisa",
			lastName: "Miller",
			role: "assistant" as const,
			assistantData: { department: "Neurology Wing" },
		},
	];

	// Resolve Keycloak IDs (dynamic when Keycloak is up, fallback placeholder otherwise)
	const keycloakIds: Record<string, string> = {};
	for (const u of staffUsers) {
		if (kcToken) {
			const id = await upsertKeycloakUser(kcToken, u);
			await assignRole(kcToken, id, u.role);
			keycloakIds[u.email] = id;
			console.log(`  ✓ ${u.email} -> ${id}`);
		} else {
			keycloakIds[u.email] = `placeholder-${u.email}`;
		}
	}

	const imgDir = path.join(__dirname, "images");
	const pngDataUri = (filename: string): string =>
		`data:image/png;base64,${fs.readFileSync(path.join(imgDir, filename)).toString("base64")}`;

	const avatarAW = pngDataUri("alice wilson.png");
	const avatarCT = pngDataUri("carol taylor.png");
	const avatarDA = pngDataUri("david anderson.png");

	const patientList = [
		{
			email: "patient.wilson@example.com",
			firstName: "Alice",
			lastName: "Wilson",
			dob: "1985-03-15",
			phone: "+31 6 12345678",
			insurance: "INS-2024-001",
			photo: avatarAW,
		},
		{
			email: "patient.moore@example.com",
			firstName: "Bob",
			lastName: "Moore",
			dob: "1972-07-22",
			phone: "+31 6 23456789",
			insurance: "INS-2024-002",
		},
		{
			email: "patient.taylor@example.com",
			firstName: "Carol",
			lastName: "Taylor",
			dob: "1990-11-08",
			phone: "+31 6 34567890",
			insurance: "INS-2024-003",
			photo: avatarCT,
		},
		{
			email: "patient.anderson@example.com",
			firstName: "David",
			lastName: "Anderson",
			dob: "1965-01-30",
			phone: "+31 6 45678901",
			insurance: "INS-2024-004",
			photo: avatarDA,
		},
		{
			email: "patient.thomas@example.com",
			firstName: "Eva",
			lastName: "Thomas",
			dob: "1998-05-19",
			phone: "+31 6 56789012",
			insurance: "INS-2024-005",
		},
	];

	const patientKcIds: Record<string, string> = {};
	for (const p of patientList) {
		if (kcToken) {
			const id = await upsertKeycloakUser(kcToken, p, SEED_PATIENT_PASSWORD);
			await assignRole(kcToken, id, "patient");
			patientKcIds[p.email] = id;
			console.log(`  ✓ ${p.email} -> ${id}`);
		} else {
			patientKcIds[p.email] = `placeholder-${p.email}`;
		}
	}

	// Create doctor users
	const doctorUsers = await Promise.all([
		prisma.user.upsert({
			where: { email: "dr.smith@clinic.local" },
			update: { keycloakId: keycloakIds["dr.smith@clinic.local"] },
			create: {
				keycloakId: keycloakIds["dr.smith@clinic.local"],
				email: "dr.smith@clinic.local",
				firstName: "James",
				lastName: "Smith",
				role: "doctor",
				doctor: { create: { specialization: "General Practice", licenseNumber: "GP-001-2024" } },
			},
			include: { doctor: true },
		}),
		prisma.user.upsert({
			where: { email: "dr.johnson@clinic.local" },
			update: { keycloakId: keycloakIds["dr.johnson@clinic.local"] },
			create: {
				keycloakId: keycloakIds["dr.johnson@clinic.local"],
				email: "dr.johnson@clinic.local",
				firstName: "Sarah",
				lastName: "Johnson",
				role: "doctor",
				doctor: { create: { specialization: "Cardiology", licenseNumber: "CARD-002-2024" } },
			},
			include: { doctor: true },
		}),
		prisma.user.upsert({
			where: { email: "dr.williams@clinic.local" },
			update: { keycloakId: keycloakIds["dr.williams@clinic.local"] },
			create: {
				keycloakId: keycloakIds["dr.williams@clinic.local"],
				email: "dr.williams@clinic.local",
				firstName: "Michael",
				lastName: "Williams",
				role: "doctor",
				doctor: { create: { specialization: "Neurology", licenseNumber: "NEUR-003-2024" } },
			},
			include: { doctor: true },
		}),
	]);

	// Create assistant users
	const assistantUsers = await Promise.all([
		prisma.user.upsert({
			where: { email: "assistant.brown@clinic.local" },
			update: { keycloakId: keycloakIds["assistant.brown@clinic.local"] },
			create: {
				keycloakId: keycloakIds["assistant.brown@clinic.local"],
				email: "assistant.brown@clinic.local",
				firstName: "Emily",
				lastName: "Brown",
				role: "assistant",
				assistant: { create: { department: "Reception" } },
			},
			include: { assistant: true },
		}),
		prisma.user.upsert({
			where: { email: "assistant.davis@clinic.local" },
			update: { keycloakId: keycloakIds["assistant.davis@clinic.local"] },
			create: {
				keycloakId: keycloakIds["assistant.davis@clinic.local"],
				email: "assistant.davis@clinic.local",
				firstName: "Robert",
				lastName: "Davis",
				role: "assistant",
				assistant: { create: { department: "Cardiology Wing" } },
			},
			include: { assistant: true },
		}),
		prisma.user.upsert({
			where: { email: "assistant.miller@clinic.local" },
			update: { keycloakId: keycloakIds["assistant.miller@clinic.local"] },
			create: {
				keycloakId: keycloakIds["assistant.miller@clinic.local"],
				email: "assistant.miller@clinic.local",
				firstName: "Lisa",
				lastName: "Miller",
				role: "assistant",
				assistant: { create: { department: "Neurology Wing" } },
			},
			include: { assistant: true },
		}),
	]);

	// Create patient users
	const patientUsers = await Promise.all(
		patientList.map(p =>
			prisma.user.upsert({
				where: { email: p.email },
				update: {
					keycloakId: patientKcIds[p.email],
					patient: { update: { photo: p.photo ?? null } },
				},
				create: {
					keycloakId: patientKcIds[p.email],
					email: p.email,
					firstName: p.firstName,
					lastName: p.lastName,
					role: "patient",
					patient: {
						create: {
							dateOfBirth: new Date(p.dob),
							phone: p.phone,
							insuranceNumber: p.insurance,
							photo: p.photo ?? null,
						},
					},
				},
				include: { patient: true },
			})
		)
	);

	const doctors = doctorUsers.map(u => u.doctor!);
	const assistants = assistantUsers.map(u => u.assistant!);
	const patients = patientUsers.map(u => u.patient!);

	// Create appointments
	const now = new Date();
	const appointmentData = [
		{
			patientId: patients[0].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
			status: "SCHEDULED" as const,
			notes: "Annual check-up",
		},
		{
			patientId: patients[1].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
			status: "CONFIRMED" as const,
			notes: "Follow-up ECG review",
		},
		{
			patientId: patients[2].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
			status: "SCHEDULED" as const,
			notes: "MRI results discussion",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
			status: "SCHEDULED" as const,
			notes: "Blood pressure check",
		},
		{
			patientId: patients[4].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
			status: "CONFIRMED" as const,
			notes: "Initial consultation",
		},
		{
			patientId: patients[0].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
			status: "COMPLETED" as const,
			notes: "Routine check - all normal",
		},
		{
			patientId: patients[1].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
			status: "COMPLETED" as const,
			notes: "Headache investigation",
		},
		{
			patientId: patients[2].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
			status: "CANCELLED" as const,
			notes: "Patient cancelled - rescheduled",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
			status: "SCHEDULED" as const,
			notes: "Neurological evaluation",
		},
		{
			patientId: patients[4].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
			status: "SCHEDULED" as const,
			notes: "Vaccination follow-up",
		},
	];

	for (const appt of appointmentData) {
		await prisma.appointment.create({ data: appt });
	}

	console.log(`✅ Seed complete:`);
	console.log(`   - ${doctorUsers.length} doctors`);
	console.log(`   - ${assistantUsers.length} assistants`);
	console.log(`   - ${patientUsers.length} patients`);
	console.log(`   - ${appointmentData.length} appointments`);
}

void main()
	.catch(e => {
		console.error("❌ Seed failed:", e);
		process.exit(1);
	})
	.finally((): void => {
		void prisma.$disconnect();
	});
