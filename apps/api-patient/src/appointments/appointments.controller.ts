import { AppointmentStatus } from "@clinic/shared-types";
import {
	Body,
	ConflictException,
	Controller,
	Get,
	Patch,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsDateString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

type ApptWithDoctorAssistant = Prisma.AppointmentGetPayload<{
	include: { doctor: { include: { user: true } }; assistant: { include: { user: true } } };
}>;
type ApptWithDoctorOnly = Prisma.AppointmentGetPayload<{
	include: { doctor: { include: { user: true } } };
}>;
type ApptWithAll = Prisma.AppointmentGetPayload<{
	include: {
		doctor: { include: { user: true } };
		assistant: { include: { user: true } };
		patient: { include: { user: true } };
	};
}>;

class RescheduleAppointmentDto {
	@IsDateString()
	scheduledAt!: string;
}

/** Slot configuration (UTC working hours, 30-min increments) */
const SLOT_MINUTES = 30;
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

/** Returns true when a Date falls on a UTC weekday */
function isUTCWeekday(d: Date): boolean {
	const dow = d.getUTCDay();
	return dow >= 1 && dow <= 5;
}

/** Returns today's UTC date at midnight */
function todayUTC(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Validates that a given ISO datetime is a legal appointment slot:
 * - Must be tomorrow or later (UTC date comparison)
 * - Must fall on a UTC weekday
 * - Must be within working hours [WORK_START_HOUR, WORK_END_HOUR)
 * - Must align to a SLOT_MINUTES boundary
 */
function validateSlotTime(iso: string): void {
	const d = new Date(iso);
	if (isNaN(d.getTime())) {
		throw new BadRequestException("Invalid scheduledAt datetime.");
	}
	const tomorrow = new Date(todayUTC().getTime() + 86_400_000);
	const utcMidnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	if (utcMidnight < tomorrow) {
		throw new BadRequestException("Appointments can only be rescheduled to tomorrow or later.");
	}
	if (!isUTCWeekday(d)) {
		throw new BadRequestException("Appointments can only be scheduled on weekdays (Mon–Fri).");
	}
	const h = d.getUTCHours();
	const m = d.getUTCMinutes();
	if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
		throw new BadRequestException(
			`Appointments must be within working hours (${WORK_START_HOUR}:00–${WORK_END_HOUR}:00 UTC).`
		);
	}
	if (m % SLOT_MINUTES !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) {
		throw new BadRequestException(`Appointment time must align to a ${SLOT_MINUTES}-minute slot boundary.`);
	}
}

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get current patient's appointments" })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: ApptWithDoctorAssistant[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const where = { patientId: dbUser.patient.id };
		const [appointments, total] = await Promise.all([
			this.prisma.appointment.findMany({
				where,
				include: {
					doctor: { include: { user: true } },
					assistant: { include: { user: true } },
				},
				orderBy: { scheduledAt: "asc" },
				take,
				skip,
			}),
			this.prisma.appointment.count({ where }),
		]);
		return { data: appointments, total };
	}

	@Get("history")
	@ApiOperation({ summary: "Get current patient's completed appointment history" })
	async getHistory(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: ApptWithDoctorOnly[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const where = { patientId: dbUser.patient.id, status: "COMPLETED" as const };
		const [appointments, total] = await Promise.all([
			this.prisma.appointment.findMany({
				where,
				include: {
					doctor: { include: { user: true } },
				},
				orderBy: { scheduledAt: "desc" },
				take,
				skip,
			}),
			this.prisma.appointment.count({ where }),
		]);
		return { data: appointments, total };
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a specific appointment (must belong to current patient)" })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithAll }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointment = await this.prisma.appointment.findUnique({
			where: { id },
			include: {
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
				patient: { include: { user: true } },
			},
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.patientId !== dbUser.patient.id) {
			throw new ForbiddenException("Access denied");
		}
		return { data: appointment };
	}

	@Patch(":id/cancel")
	@ApiOperation({ summary: "Cancel an appointment as the current patient" })
	async cancel(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithDoctorOnly; message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.patientId !== dbUser.patient.id) throw new ForbiddenException("Access denied");

		const cancellable: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED"];
		if (!cancellable.includes(appointment.status as AppointmentStatus)) {
			throw new BadRequestException(`Cannot cancel appointment with status ${appointment.status}`);
		}

		// Same-day cancellations are not allowed — the patient must call the clinic
		const apptUTCDate = new Date(
			Date.UTC(
				appointment.scheduledAt.getUTCFullYear(),
				appointment.scheduledAt.getUTCMonth(),
				appointment.scheduledAt.getUTCDate()
			)
		);
		if (apptUTCDate.getTime() === todayUTC().getTime()) {
			throw new BadRequestException("Same-day cancellation is not possible online. Please call the clinic directly.");
		}

		const updated = await this.prisma.appointment.update({
			where: { id },
			data: { status: "CANCELLED" },
			include: { doctor: { include: { user: true } } },
		});

		await this.prisma.appointmentStatusChange.create({
			data: {
				appointmentId: id,
				previousStatus: appointment.status,
				newStatus: "CANCELLED",
				changedByKeycloakId: user.sub,
			},
		});

		return { data: updated, message: "Appointment cancelled" };
	}

	@Patch(":id/reschedule")
	@ApiOperation({ summary: "Reschedule an appointment to a new free slot" })
	async reschedule(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: RescheduleAppointmentDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithDoctorOnly; message: string }> {
		// Validate the requested slot before hitting the DB
		validateSlotTime(dto.scheduledAt);

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.patientId !== dbUser.patient.id) throw new ForbiddenException("Access denied");

		const reschedulable: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED"];
		if (!reschedulable.includes(appointment.status as AppointmentStatus)) {
			throw new BadRequestException(`Cannot reschedule appointment with status ${appointment.status}`);
		}

		const newScheduledAt = new Date(dto.scheduledAt);
		const previousScheduledAt = appointment.scheduledAt;

		// Concurrency-safe: check for a conflicting booking and update atomically
		const updated = await this.prisma.$transaction(
			async tx => {
				const conflict = await tx.appointment.findFirst({
					where: {
						id: { not: id },
						doctorId: appointment.doctorId,
						scheduledAt: newScheduledAt,
						status: { not: "CANCELLED" },
					},
					select: { id: true },
				});
				if (conflict) {
					throw new ConflictException(
						"This slot has just been taken by another patient. Please choose a different time."
					);
				}

				const result = await tx.appointment.update({
					where: { id },
					data: { scheduledAt: newScheduledAt },
					include: { doctor: { include: { user: true } } },
				});

				await tx.appointmentStatusChange.create({
					data: {
						appointmentId: id,
						previousStatus: appointment.status,
						newStatus: appointment.status,
						previousScheduledAt,
						newScheduledAt,
						changedByKeycloakId: user.sub,
					},
				});

				return result;
			},
			{ isolationLevel: "Serializable" }
		);

		return { data: updated, message: "Appointment rescheduled" };
	}
}
