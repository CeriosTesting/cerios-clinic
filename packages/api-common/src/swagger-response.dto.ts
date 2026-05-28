import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Shared Swagger metadata for the nullable `assistantId` UUID field. */
export const ASSISTANT_ID_API_PROPERTY = {
	type: String,
	format: "uuid",
	nullable: true,
	example: "de305d54-75b4-431b-adb2-eb6b9e546014",
} as const;

export class UserNameResponseDto {
	@ApiProperty({ example: "Alex" })
	firstName!: string;

	@ApiProperty({ example: "Morgan" })
	lastName!: string;
}

export class UserNameEmailResponseDto extends UserNameResponseDto {
	@ApiProperty({ format: "email", example: "patient@example.com" })
	email!: string;
}

export class UserCoreResponseDto {
	@ApiProperty({ format: "uuid", example: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" })
	id!: string;

	@ApiProperty({ example: "90bb0a13-a7be-4f8b-b071-e07d1f7b8bc2" })
	keycloakId!: string;

	@ApiProperty({ format: "email", example: "doctor@example.com" })
	email!: string;

	@ApiProperty({ example: "Alex" })
	firstName!: string;

	@ApiProperty({ example: "Morgan" })
	lastName!: string;

	@ApiProperty({ enum: ["patient", "doctor", "assistant", "admin"], example: "doctor" })
	role!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	deletedAt?: string | null;
}

export class PatientCoreResponseDto {
	@ApiProperty({ format: "uuid", example: "c56a4180-65aa-42ec-a945-5fd21dec0538" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" })
	userId!: string;

	@ApiPropertyOptional({ type: String, format: "date", nullable: true, example: "1990-01-15" })
	dateOfBirth?: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "+31 6 1234 5678" })
	phone?: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "INS-2026-001" })
	insuranceNumber?: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..." })
	photo?: string | null;

	@ApiProperty({ example: true })
	emailNotificationsEnabled!: boolean;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;
}

export class DoctorCoreResponseDto {
	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" })
	userId!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Cardiology" })
	specialization?: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "MED-12345" })
	licenseNumber?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;
}

export class AssistantCoreResponseDto {
	@ApiProperty({ format: "uuid", example: "de305d54-75b4-431b-adb2-eb6b9e546014" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" })
	userId!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Front Desk" })
	department?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;
}

export class MessageResponseDto {
	@ApiProperty({ example: "Operation completed successfully" })
	message!: string;
}

export class HealthResponseDto {
	@ApiProperty({ example: "ok" })
	status!: string;

	@ApiProperty({ example: "api-assistant" })
	service!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	timestamp!: string;
}

export class FeatureToggleResponseDto {
	@ApiProperty({ format: "uuid", example: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" })
	id!: string;

	@ApiProperty({ example: "bug:same-day-restriction" })
	key!: string;

	@ApiProperty({ example: false })
	enabled!: boolean;

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		example: "When enabled, disables API-side same-day appointment restrictions.",
	})
	description?: string | null;

	@ApiPropertyOptional({ type: Object, additionalProperties: true, nullable: true, example: { rolloutPercentage: 50 } })
	config?: Record<string, unknown> | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;
}

export class FeatureToggleListResponseDto {
	@ApiProperty({ type: () => FeatureToggleResponseDto, isArray: true })
	data!: FeatureToggleResponseDto[];
}

export class FeatureToggleDetailResponseDto {
	@ApiProperty({ type: () => FeatureToggleResponseDto })
	data!: FeatureToggleResponseDto;
}

export class UiTogglesDataResponseDto {
	@ApiProperty({ example: false })
	showFooterLogo!: boolean;
}

export class UiTogglesResponseDto {
	@ApiProperty({ type: () => UiTogglesDataResponseDto })
	data!: UiTogglesDataResponseDto;
}

export class AppointmentSummaryResponseDto {
	@ApiProperty({ format: "date-time", example: "2026-06-15T09:30:00.000Z" })
	scheduledAt!: string;

	@ApiProperty({ enum: ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"], example: "CONFIRMED" })
	status!: string;
}

export class AppointmentDateResponseDto {
	@ApiProperty({ format: "date-time", example: "2026-06-15T09:30:00.000Z" })
	scheduledAt!: string;
}

export class AppointmentRecordResponseDto {
	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "c56a4180-65aa-42ec-a945-5fd21dec0538" })
	patientId!: string;

	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	doctorId!: string;

	@ApiPropertyOptional(ASSISTANT_ID_API_PROPERTY)
	assistantId?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-06-15T09:30:00.000Z" })
	scheduledAt!: string;

	@ApiProperty({ enum: ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"], example: "CONFIRMED" })
	status!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Follow-up consultation" })
	notes?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;
}

export class AppointmentStatusCountsResponseDto {
	@ApiProperty({ example: 12 })
	SCHEDULED!: number;

	@ApiProperty({ example: 8 })
	CONFIRMED!: number;

	@ApiProperty({ example: 31 })
	COMPLETED!: number;

	@ApiProperty({ example: 4 })
	CANCELLED!: number;
}

export class AppointmentStatsDataResponseDto {
	@ApiProperty({ example: 5 })
	todayCount!: number;

	@ApiProperty({ example: 18 })
	upcomingCount!: number;

	@ApiProperty({ example: 31 })
	completedCount!: number;

	@ApiProperty({ example: 4 })
	cancelledCount!: number;

	@ApiProperty({ example: 55 })
	totalCount!: number;

	@ApiProperty({ type: () => AppointmentStatusCountsResponseDto })
	byStatus!: AppointmentStatusCountsResponseDto;
}

export class AppointmentStatusHistoryItemResponseDto {
	@ApiProperty({ format: "uuid", example: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	appointmentId!: string;

	@ApiPropertyOptional({
		type: String,
		enum: ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"],
		nullable: true,
		example: "SCHEDULED",
	})
	previousStatus?: string | null;

	@ApiProperty({ enum: ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"], example: "CONFIRMED" })
	newStatus!: string;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	previousScheduledAt?: string | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	newScheduledAt?: string | null;

	@ApiProperty({ example: "90bb0a13-a7be-4f8b-b071-e07d1f7b8bc2" })
	changedByKeycloakId!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:45:00.000Z" })
	changedAt!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Jamie Lee" })
	changedByName?: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "assistant" })
	changedByRole?: string | null;
}

export class PrescriptionItemResponseDto {
	@ApiProperty({ format: "uuid", example: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	prescriptionId!: string;

	@ApiProperty({ example: "Amoxicillin" })
	medicationName!: string;

	@ApiProperty({ example: "500 mg" })
	dosage!: string;

	@ApiProperty({ example: "Twice daily" })
	frequency!: string;

	@ApiProperty({ example: "7 days" })
	duration!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Take after meals" })
	instructions?: string | null;
}

export class PrescriptionRecordResponseDto {
	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "8b43ab13-ef91-4b27-a0bb-0882e9bf65d6" })
	appointmentId!: string;

	@ApiProperty({ format: "uuid", example: "c56a4180-65aa-42ec-a945-5fd21dec0538" })
	patientId!: string;

	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	doctorId!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Monitor blood pressure during this course." })
	notes?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;
}

export class ReviewRecordResponseDto {
	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "8b43ab13-ef91-4b27-a0bb-0882e9bf65d6" })
	appointmentId!: string;

	@ApiProperty({ format: "uuid", example: "c56a4180-65aa-42ec-a945-5fd21dec0538" })
	patientId!: string;

	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	doctorId!: string;

	@ApiProperty({ minimum: 1, maximum: 5, example: 5 })
	rating!: number;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Very clear explanation and punctual consultation." })
	comment?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;
}

export class ReviewStatsResponseDto {
	@ApiProperty({ example: 4.7 })
	averageRating!: number;

	@ApiProperty({ example: 18 })
	totalReviews!: number;
}
