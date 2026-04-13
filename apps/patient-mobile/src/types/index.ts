// Local copy of the types from packages/shared-types — kept in sync manually.

export type UserRole = "patient" | "doctor" | "assistant" | "admin";

export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface User {
	id: string;
	keycloakId: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	createdAt: string;
	deletedAt?: string | null;
}

export interface Patient {
	id: string;
	userId: string;
	dateOfBirth?: string | null;
	phone?: string | null;
	insuranceNumber?: string | null;
	photo?: string | null;
	user?: User;
}

export interface Doctor {
	id: string;
	userId: string;
	specialization?: string | null;
	licenseNumber?: string | null;
	user?: User;
}

export interface Appointment {
	id: string;
	patientId: string;
	doctorId: string;
	assistantId?: string | null;
	scheduledAt: string;
	status: AppointmentStatus;
	notes?: string | null;
	createdAt: string;
	updatedAt: string;
	patient?: Patient;
	doctor?: Doctor;
}

export interface DoctorPublic {
	id: string;
	userId: string;
	specialization?: string | null;
	firstName: string;
	lastName: string;
}

export interface DoctorSlotAvailability {
	date: string;
	slots: string[];
}

export interface UpdateProfileDto {
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	phone?: string;
	insuranceNumber?: string;
}

export interface RescheduleAppointmentDto {
	scheduledAt: string;
}

export interface ProfileData {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	patient: Pick<Patient, "dateOfBirth" | "phone" | "insuranceNumber" | "photo"> | null;
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface Review {
	id: string;
	appointmentId: string;
	patientId: string;
	doctorId: string;
	rating: number;
	comment?: string | null;
	createdAt: string;
	appointment?: Appointment;
	doctor?: Doctor;
}

export interface CreateReviewDto {
	rating: number;
	comment?: string;
}

export interface DoctorReviewStats {
	data: Review[];
	stats: {
		averageRating: number;
		totalReviews: number;
	};
}

// ── Prescriptions ─────────────────────────────────────────────────────────────

export interface PrescriptionItem {
	id: string;
	prescriptionId: string;
	medicationName: string;
	dosage: string;
	frequency: string;
	duration: string;
	instructions?: string | null;
}

export interface Prescription {
	id: string;
	appointmentId: string;
	patientId: string;
	doctorId: string;
	notes?: string | null;
	createdAt: string;
	items: PrescriptionItem[];
	doctor?: Doctor;
	appointment?: Appointment;
}
