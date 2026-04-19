import fs from "fs";
import path from "path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8180";
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

	/**
	 * Returns a UTC Date that is `daysAhead` working days (Mon–Fri) from today,
	 * at the given UTC hour and 30-min-aligned minute.
	 * Negative values step backward through weekdays for past appointments.
	 */
	function slotUTC(daysAhead: number, hour: number, minute: 0 | 30): Date {
		const today = new Date();
		const base = new Date(
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, minute, 0, 0)
		);
		const step = daysAhead >= 0 ? 1 : -1;
		let remaining = Math.abs(daysAhead);
		const cursor = new Date(base);
		while (remaining > 0) {
			cursor.setUTCDate(cursor.getUTCDate() + step);
			const dow = cursor.getUTCDay(); // 0=Sun, 6=Sat
			if (dow >= 1 && dow <= 5) remaining--;
		}
		return cursor;
	}

	// Clear existing seeded data to prevent duplicates on re-seed
	const seededPatientEmails = patientList.map(p => p.email);
	const seededPatientFilter = { patient: { user: { email: { in: seededPatientEmails } } } };

	await prisma.prescriptionItem.deleteMany({ where: { prescription: seededPatientFilter } });
	await prisma.prescription.deleteMany({ where: seededPatientFilter });
	await prisma.review.deleteMany({ where: seededPatientFilter });
	await prisma.appointmentStatusChange.deleteMany({ where: { appointment: seededPatientFilter } });
	await prisma.appointment.deleteMany({ where: seededPatientFilter });
	await prisma.doctorUnavailability.deleteMany({
		where: { doctor: { user: { email: { in: staffUsers.filter(s => s.role === "doctor").map(s => s.email) } } } },
	});

	const appointmentData = [
		// Today's appointments
		{
			patientId: patients[0].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(0, 9, 0),
			status: "SCHEDULED" as const,
			notes: "Annual check-up",
		},
		{
			patientId: patients[1].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: slotUTC(0, 10, 30),
			status: "CONFIRMED" as const,
			notes: "Follow-up ECG review",
		},
		{
			patientId: patients[2].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(0, 14, 0),
			status: "SCHEDULED" as const,
			notes: "MRI results discussion",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(0, 15, 30),
			status: "CONFIRMED" as const,
			notes: "Blood pressure check",
		},
		// Upcoming appointments (N working days ahead, valid 30-min UTC slots)
		{
			patientId: patients[0].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(1, 9, 0),
			status: "SCHEDULED" as const,
			notes: "Annual check-up",
		},
		{
			patientId: patients[1].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: slotUTC(2, 10, 30),
			status: "CONFIRMED" as const,
			notes: "Follow-up ECG review",
		},
		{
			patientId: patients[2].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(3, 14, 0),
			status: "SCHEDULED" as const,
			notes: "MRI results discussion",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(5, 11, 0),
			status: "SCHEDULED" as const,
			notes: "Blood pressure check",
		},
		{
			patientId: patients[4].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: slotUTC(7, 15, 30),
			status: "CONFIRMED" as const,
			notes: "Initial consultation",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(10, 9, 30),
			status: "SCHEDULED" as const,
			notes: "Neurological evaluation",
		},
		{
			patientId: patients[4].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(14, 13, 0),
			status: "SCHEDULED" as const,
			notes: "Vaccination follow-up",
		},
		// Past appointments (N working days ago)
		{
			patientId: patients[0].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(-3, 10, 0),
			status: "COMPLETED" as const,
			notes: "Routine check - all normal",
		},
		{
			patientId: patients[1].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(-7, 9, 0),
			status: "COMPLETED" as const,
			notes: "Headache investigation",
		},
		{
			patientId: patients[2].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: slotUTC(-14, 11, 30),
			status: "CANCELLED" as const,
			notes: "Patient cancelled - rescheduled",
		},
		// Additional completed appointments for reviews & prescriptions
		{
			patientId: patients[2].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(-10, 10, 0),
			status: "COMPLETED" as const,
			notes: "Flu symptoms - prescribed medication",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[1].id,
			assistantId: assistants[1].id,
			scheduledAt: slotUTC(-5, 14, 0),
			status: "COMPLETED" as const,
			notes: "Cardiac follow-up - stable",
		},
		{
			patientId: patients[4].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(-8, 11, 0),
			status: "COMPLETED" as const,
			notes: "Migraine consultation",
		},
		{
			patientId: patients[0].id,
			doctorId: doctors[0].id,
			assistantId: assistants[0].id,
			scheduledAt: slotUTC(-20, 9, 30),
			status: "COMPLETED" as const,
			notes: "General check-up - all clear",
		},
		{
			patientId: patients[3].id,
			doctorId: doctors[2].id,
			assistantId: assistants[2].id,
			scheduledAt: slotUTC(-15, 13, 0),
			status: "COMPLETED" as const,
			notes: "Neurological evaluation follow-up",
		},
	];

	const createdAppointments = [];
	for (const appt of appointmentData) {
		const created = await prisma.appointment.create({ data: appt });
		createdAppointments.push({ ...created, ...appt });
	}

	// ── Reviews for completed appointments ────────────────────────────────────
	const completedAppointments = createdAppointments.filter(a => a.status === "COMPLETED");

	const reviewData: Array<{
		appointmentId: string;
		patientId: string;
		doctorId: string;
		rating: number;
		comment?: string;
	}> = [
		{
			appointmentId: completedAppointments[0].id,
			patientId: completedAppointments[0].patientId,
			doctorId: completedAppointments[0].doctorId,
			rating: 5,
			comment: "Very thorough examination. Dr. Williams explained everything clearly.",
		},
		{
			appointmentId: completedAppointments[1].id,
			patientId: completedAppointments[1].patientId,
			doctorId: completedAppointments[1].doctorId,
			rating: 4,
			comment: "Good doctor, but the wait time was a bit long.",
		},
		{
			appointmentId: completedAppointments[2].id,
			patientId: completedAppointments[2].patientId,
			doctorId: completedAppointments[2].doctorId,
			rating: 5,
			comment: "Dr. Smith was incredibly attentive and caring. Highly recommend!",
		},
		{
			appointmentId: completedAppointments[3].id,
			patientId: completedAppointments[3].patientId,
			doctorId: completedAppointments[3].doctorId,
			rating: 4,
			comment: "Professional and knowledgeable. Answered all my questions.",
		},
		{
			appointmentId: completedAppointments[4].id,
			patientId: completedAppointments[4].patientId,
			doctorId: completedAppointments[4].doctorId,
			rating: 3,
			comment: "The consultation was okay, but felt a bit rushed.",
		},
		{
			appointmentId: completedAppointments[5].id,
			patientId: completedAppointments[5].patientId,
			doctorId: completedAppointments[5].doctorId,
			rating: 5,
		},
		{
			appointmentId: completedAppointments[6].id,
			patientId: completedAppointments[6].patientId,
			doctorId: completedAppointments[6].doctorId,
			rating: 4,
			comment: "Great follow-up. Felt well taken care of.",
		},
	];

	for (const review of reviewData) {
		await prisma.review.create({ data: review });
	}

	// ── Prescriptions for completed appointments ──────────────────────────────
	const prescriptionData = [
		{
			appointmentId: completedAppointments[0].id,
			patientId: completedAppointments[0].patientId,
			doctorId: completedAppointments[0].doctorId,
			notes: "Follow-up in 2 weeks if symptoms persist.",
			items: [
				{
					medicationName: "Ibuprofen",
					dosage: "400mg",
					frequency: "3 times daily",
					duration: "7 days",
					instructions: "Take with food",
				},
				{
					medicationName: "Vitamin D3",
					dosage: "1000 IU",
					frequency: "Once daily",
					duration: "30 days",
					instructions: "Take in the morning",
				},
			],
		},
		{
			appointmentId: completedAppointments[1].id,
			patientId: completedAppointments[1].patientId,
			doctorId: completedAppointments[1].doctorId,
			notes: "Reduce caffeine intake. Return if headaches continue.",
			items: [
				{
					medicationName: "Paracetamol",
					dosage: "500mg",
					frequency: "As needed, max 4x daily",
					duration: "14 days",
					instructions: "Do not exceed 2000mg per day",
				},
				{
					medicationName: "Magnesium",
					dosage: "400mg",
					frequency: "Once daily",
					duration: "30 days",
					instructions: "Take before bed",
				},
			],
		},
		{
			appointmentId: completedAppointments[2].id,
			patientId: completedAppointments[2].patientId,
			doctorId: completedAppointments[2].doctorId,
			notes: "Rest well, stay hydrated, avoid contact with others for 5 days.",
			items: [
				{
					medicationName: "Oseltamivir",
					dosage: "75mg",
					frequency: "Twice daily",
					duration: "5 days",
					instructions: "Start within 48 hours of symptom onset",
				},
				{
					medicationName: "Dextromethorphan",
					dosage: "20mg",
					frequency: "Every 4 hours",
					duration: "7 days",
					instructions: "Cough suppressant — do not exceed 6 doses/day",
				},
				{ medicationName: "Throat lozenges", dosage: "1 lozenge", frequency: "Every 2 hours", duration: "5 days" },
			],
		},
		{
			appointmentId: completedAppointments[3].id,
			patientId: completedAppointments[3].patientId,
			doctorId: completedAppointments[3].doctorId,
			items: [
				{
					medicationName: "Amlodipine",
					dosage: "5mg",
					frequency: "Once daily",
					duration: "90 days",
					instructions: "Monitor blood pressure weekly",
				},
				{
					medicationName: "Aspirin",
					dosage: "81mg",
					frequency: "Once daily",
					duration: "90 days",
					instructions: "Take with breakfast",
				},
			],
		},
		{
			appointmentId: completedAppointments[4].id,
			patientId: completedAppointments[4].patientId,
			doctorId: completedAppointments[4].doctorId,
			notes: "Keep a headache diary. Avoid bright screens before sleep.",
			items: [
				{
					medicationName: "Sumatriptan",
					dosage: "50mg",
					frequency: "At onset of migraine",
					duration: "As needed",
					instructions: "Maximum 2 tablets in 24 hours",
				},
				{
					medicationName: "Propranolol",
					dosage: "40mg",
					frequency: "Twice daily",
					duration: "60 days",
					instructions: "Preventive — do not stop abruptly",
				},
			],
		},
	];

	for (const rx of prescriptionData) {
		const { items, ...prescriptionFields } = rx;
		await prisma.prescription.create({
			data: {
				...prescriptionFields,
				items: { create: items },
			},
		});
	}

	// ── Doctor unavailability blocks ──────────────────────────────────────────
	const unavailabilityData = [
		{
			doctorId: doctors[0].id,
			startDate: slotUTC(15, 0, 0),
			endDate: slotUTC(19, 0, 0),
			reason: "Annual leave",
		},
		{
			doctorId: doctors[1].id,
			startDate: slotUTC(8, 0, 0),
			endDate: slotUTC(9, 0, 0),
			reason: "Medical conference",
		},
		{
			doctorId: doctors[2].id,
			startDate: slotUTC(22, 0, 0),
			endDate: slotUTC(26, 0, 0),
			reason: "Personal time off",
		},
	];

	for (const block of unavailabilityData) {
		await prisma.doctorUnavailability.create({ data: block });
	}

	console.log(`✅ Seed complete:`);
	console.log(`   - ${doctorUsers.length} doctors`);
	console.log(`   - ${assistantUsers.length} assistants`);
	console.log(`   - ${patientUsers.length} patients`);
	console.log(`   - ${appointmentData.length} appointments`);
	console.log(`   - ${reviewData.length} reviews`);
	console.log(`   - ${prescriptionData.length} prescriptions`);
	console.log(`   - ${unavailabilityData.length} doctor unavailability blocks`);
}

void main()
	.catch(e => {
		console.error("❌ Seed failed:", e);
		process.exit(1);
	})
	.finally((): void => {
		void prisma.$disconnect();
	});
