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
	previousScheduledAt?: string | null;
	newScheduledAt?: string | null;
	changedByKeycloakId: string;
	changedByName?: string | null;
	changedAt: string;
}

export interface RescheduleAppointmentDto {
	scheduledAt: string;
}

export interface DoctorSlotAvailability {
	date: string;
	slots: string[];
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
	averageRating?: number | null;
	reviewCount?: number;
}

// --- Reviews ---

export interface Review {
	id: string;
	appointmentId: string;
	patientId: string;
	doctorId: string;
	rating: number;
	comment?: string | null;
	createdAt: string;
	patient?: Patient;
	doctor?: Doctor;
	appointment?: Appointment;
}

export interface CreateReviewDto {
	rating: number;
	comment?: string;
}

export interface DoctorReviewStats {
	averageRating: number;
	totalReviews: number;
}

// --- Doctor Unavailability ---

export interface DoctorUnavailability {
	id: string;
	doctorId: string;
	startDate: string;
	endDate: string;
	reason?: string | null;
	createdAt: string;
}

export interface CreateUnavailabilityDto {
	startDate: string;
	endDate: string;
	reason?: string;
}

// --- Prescriptions ---

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
	updatedAt: string;
	items: PrescriptionItem[];
	patient?: Patient;
	doctor?: Doctor;
	appointment?: Appointment;
}

export interface CreatePrescriptionItemDto {
	medicationName: string;
	dosage: string;
	frequency: string;
	duration: string;
	instructions?: string;
}

export interface CreatePrescriptionDto {
	appointmentId: string;
	notes?: string;
	items: CreatePrescriptionItemDto[];
}

export interface UpdatePrescriptionDto {
	notes?: string;
	items?: CreatePrescriptionItemDto[];
}

// --- Feature Toggles ---

export interface FeatureToggle {
	id: string;
	key: string;
	enabled: boolean;
	description?: string | null;
	config?: Record<string, unknown> | null;
	updatedAt: string;
	createdAt: string;
}

export interface UpdateFeatureToggleDto {
	enabled?: boolean;
	config?: Record<string, unknown>;
}

/** Known feature toggle keys */
export const FEATURE_TOGGLE_KEYS = {
	API_SLOWDOWN: "bug:api-slowdown",
	SAME_DAY_RESTRICTION: "bug:same-day-restriction",
	PROFILE_VALIDATION_FRONTEND: "bug:profile-validation-frontend",
	PROFILE_VALIDATION_BACKEND: "bug:profile-validation-backend",
	SHOW_FOOTER_LOGO: "bug:show-footer-logo",
} as const;

export interface ApiSlowdownConfig {
	minDelayMs: number;
	maxDelayMs: number;
}
