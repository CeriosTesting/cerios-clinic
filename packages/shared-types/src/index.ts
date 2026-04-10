export type UserRole = "patient" | "doctor" | "assistant" | "admin";

export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

/** Valid status transitions. Terminal states (COMPLETED, CANCELLED) have empty arrays. */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
	SCHEDULED: ["CONFIRMED", "CANCELLED"],
	CONFIRMED: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
};

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

export interface Assistant {
	id: string;
	userId: string;
	department?: string | null;
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
	assistant?: Assistant | null;
}

// --- API Request/Response shapes ---

export interface CreateAppointmentDto {
	patientId: string;
	doctorId: string;
	scheduledAt: string;
	notes?: string;
}

export interface UpdateAppointmentDto {
	scheduledAt?: string;
	status?: AppointmentStatus;
	notes?: string;
}

export interface CreateDoctorDto {
	email: string;
	firstName: string;
	lastName: string;
	specialization?: string;
	licenseNumber?: string;
	password: string;
}

export interface UpdateDoctorDto {
	firstName?: string;
	lastName?: string;
	specialization?: string;
	licenseNumber?: string;
}

export interface CreateAssistantDto {
	email: string;
	firstName: string;
	lastName: string;
	department?: string;
	password: string;
}

export interface UpdateAssistantDto {
	firstName?: string;
	lastName?: string;
	department?: string;
}

export interface SyncUserDto {
	keycloakId: string;
	email: string;
	firstName: string;
	lastName: string;
}

export interface UpdateProfileDto {
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	phone?: string;
	insuranceNumber?: string;
}

export interface ApiResponse<T> {
	data: T;
	message?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
}

export interface AppointmentFilters {
	status?: AppointmentStatus;
	from?: string;
	to?: string;
	doctorId?: string;
	patientId?: string;
}

export interface AppointmentStatusChange {
	id: string;
	appointmentId: string;
	previousStatus?: AppointmentStatus | null;
	newStatus: AppointmentStatus;
	changedByKeycloakId: string;
	changedByName?: string | null;
	changedAt: string;
}

export interface AppointmentStats {
	todayCount: number;
	upcomingCount: number;
	completedCount: number;
	cancelledCount: number;
	totalCount: number;
	byStatus: Record<AppointmentStatus, number>;
}

/** Lightweight doctor info for public listing (patient portal) */
export interface DoctorPublic {
	id: string;
	userId: string;
	specialization?: string | null;
	firstName: string;
	lastName: string;
}
