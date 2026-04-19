import { EventsService, MailService } from "@clinic/api-common";
import { ALLOWED_TRANSITIONS, AppointmentStatus } from "@clinic/shared-types";
import {
	Controller,
	Get,
	Put,
	Param,
	ParseUUIDPipe,
	Body,
	Query,
	UseGuards,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { Prisma, AppointmentStatus as AppointmentStatusEnum, AppointmentStatusChange } from "@prisma/client";
import { IsString, IsOptional, IsEnum, IsDateString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

type ApptWithPatientAssistant = Prisma.AppointmentGetPayload<{
	include: { patient: { include: { user: true } }; assistant: { include: { user: true } } };
}>;
type ApptWithAll = Prisma.AppointmentGetPayload<{
	include: {
		patient: { include: { user: true } };
		assistant: { include: { user: true } };
		doctor: { include: { user: true } };
	};
}>;
type AppointmentStats = {
	todayCount: number;
	upcomingCount: number;
	completedCount: number;
	cancelledCount: number;
	totalCount: number;
	byStatus: Record<AppointmentStatus, number>;
};
type EnrichedStatusChange = AppointmentStatusChange & {
	changedByName: string | null;
	changedByRole: string | null;
};

class UpdateAppointmentDto {
	@IsOptional()
	@IsEnum(AppointmentStatusEnum)
	status?: AppointmentStatus;

	@IsOptional() @IsString() notes?: string;
	@IsOptional() @IsDateString() scheduledAt?: string;
}

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mail: MailService,
		private readonly events: EventsService
	) {}

	@Get()
	@ApiOperation({ summary: "Get doctor's appointments (filterable)" })
	@ApiQuery({ name: "status", required: false })
	@ApiQuery({ name: "from", required: false })
	@ApiQuery({ name: "to", required: false })
	@ApiQuery({ name: "limit", required: false, description: "Max results (default 50, max 200)" })
	@ApiQuery({ name: "offset", required: false, description: "Skip this many results (default 0)" })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("status") status?: string,
		@Query("from") from?: string,
		@Query("to") to?: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: ApptWithPatientAssistant[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const where: Record<string, unknown> = { doctorId: dbUser.doctor.id };
		if (status) where["status"] = status;
		if (from || to) {
			if (from && isNaN(new Date(from).getTime())) throw new BadRequestException("Invalid 'from' date");
			if (to && isNaN(new Date(to).getTime())) throw new BadRequestException("Invalid 'to' date");
			where["scheduledAt"] = {
				...(from && { gte: new Date(from) }),
				...(to && { lte: new Date(to) }),
			};
		}

		const [appointments, total] = await Promise.all([
			this.prisma.appointment.findMany({
				where,
				include: {
					patient: { include: { user: true } },
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

	@Get("stats")
	@ApiOperation({ summary: "Get aggregate appointment stats for the current doctor" })
	async getStats(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: AppointmentStats }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const doctorId = dbUser.doctor.id;
		const now = new Date();
		const todayStart = new Date(now);
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date(now);
		todayEnd.setHours(23, 59, 59, 999);

		const [all, todayAppointments, upcoming] = await Promise.all([
			this.prisma.appointment.groupBy({
				by: ["status"],
				where: { doctorId },
				_count: { id: true },
			}),
			this.prisma.appointment.count({
				where: { doctorId, scheduledAt: { gte: todayStart, lte: todayEnd } },
			}),
			this.prisma.appointment.count({
				where: { doctorId, scheduledAt: { gt: todayEnd }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
			}),
		]);

		const byStatus = { SCHEDULED: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 } as Record<AppointmentStatus, number>;
		for (const row of all) byStatus[row.status as AppointmentStatus] = row._count.id;

		return {
			data: {
				todayCount: todayAppointments,
				upcomingCount: upcoming,
				completedCount: byStatus.COMPLETED,
				cancelledCount: byStatus.CANCELLED,
				totalCount: all.reduce((s, r) => s + r._count.id, 0),
				byStatus,
			},
		};
	}

	@Get(":id")
	@ApiOperation({ summary: "Get appointment detail" })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithAll }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const appointment = await this.prisma.appointment.findUnique({
			where: { id },
			include: {
				patient: { include: { user: true } },
				assistant: { include: { user: true } },
				doctor: { include: { user: true } },
			},
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.doctorId !== dbUser.doctor.id) throw new ForbiddenException("Access denied");
		return { data: appointment };
	}

	@Get(":id/history")
	@ApiOperation({ summary: "Get status change history for an appointment" })
	async getHistory(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: EnrichedStatusChange[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.doctorId !== dbUser.doctor.id) throw new ForbiddenException("Access denied");

		const history = await this.prisma.appointmentStatusChange.findMany({
			where: { appointmentId: id },
			orderBy: { changedAt: "asc" },
		});

		const keycloakIds = [...new Set(history.map(h => h.changedByKeycloakId))];
		const users = await this.prisma.user.findMany({
			where: { keycloakId: { in: keycloakIds } },
			select: { keycloakId: true, firstName: true, lastName: true, role: true },
		});
		const userMap = Object.fromEntries(users.map(u => [u.keycloakId, u]));

		const enriched = history.map(h => {
			const actor = userMap[h.changedByKeycloakId];
			return {
				...h,
				changedByName: actor ? `${actor.firstName} ${actor.lastName}` : null,
				changedByRole: actor?.role ?? null,
			};
		});

		return { data: enriched };
	}

	@Put(":id")
	@ApiOperation({ summary: "Update appointment status and/or notes" })
	async update(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateAppointmentDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithAll }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.doctorId !== dbUser.doctor.id) throw new ForbiddenException("Access denied");

		this.validateStatusTransition(dto, appointment);

		const updated = await this.prisma.appointment.update({
			where: { id },
			data: {
				...(dto.status && { status: dto.status }),
				...(dto.notes !== undefined && { notes: dto.notes }),
				...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
			},
			include: {
				patient: { include: { user: true } },
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
			},
		});

		if (dto.status && dto.status !== appointment.status) {
			await this.recordStatusChangeAndNotify(id, appointment.status, dto.status, user.sub, updated);
		}

		return { data: updated };
	}

	private validateStatusTransition(dto: UpdateAppointmentDto, appointment: { status: string }): void {
		if (dto.status && dto.status !== appointment.status) {
			const allowed = ALLOWED_TRANSITIONS[appointment.status as AppointmentStatus];
			if (!allowed.includes(dto.status)) {
				throw new BadRequestException(
					`Cannot transition from ${appointment.status} to ${dto.status}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`
				);
			}
		}
	}

	private async recordStatusChangeAndNotify(
		appointmentId: string,
		previousStatus: string,
		newStatus: string,
		changedByKeycloakId: string,
		updated: ApptWithAll
	): Promise<void> {
		await this.prisma.appointmentStatusChange.create({
			data: { appointmentId, previousStatus, newStatus, changedByKeycloakId },
		});

		const patientUser = updated.patient?.user;
		const doctorUser = updated.doctor?.user;
		if (patientUser && doctorUser) {
			const patientName = `${patientUser.firstName} ${patientUser.lastName}`;
			const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
			if (newStatus === "CONFIRMED") {
				void this.mail.sendAppointmentConfirmation(patientUser.email, patientName, doctorName, updated.scheduledAt);
			} else if (newStatus === "CANCELLED") {
				void this.mail.sendAppointmentCancellation(
					patientUser.email,
					patientName,
					doctorName,
					patientName,
					updated.scheduledAt
				);
			}
		}

		this.events.emitAppointmentEvent({
			type: newStatus === "CANCELLED" ? "appointment.cancelled" : "appointment.updated",
			appointmentId: updated.id,
			patientId: updated.patientId,
			doctorId: updated.doctorId,
			status: updated.status,
			scheduledAt: updated.scheduledAt.toISOString(),
		});
	}
}
