import { ALLOWED_TRANSITIONS, AppointmentStatus } from "@clinic/shared-types";
import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
	NotFoundException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import {
	Prisma,
	Appointment,
	AppointmentStatus as AppointmentStatusEnum,
	AppointmentStatusChange,
} from "@prisma/client";
import { IsString, IsOptional, IsEnum, IsDateString, IsUUID } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

type ApptWithAll = Prisma.AppointmentGetPayload<{
	include: {
		patient: { include: { user: true } };
		doctor: { include: { user: true } };
		assistant: { include: { user: true } };
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

class CreateAppointmentDto {
	@IsUUID() patientId: string;
	@IsUUID() doctorId: string;
	@IsDateString() scheduledAt: string;
	@IsOptional() @IsString() notes?: string;
}

class UpdateAppointmentDto {
	@IsOptional()
	@IsEnum(AppointmentStatusEnum)
	status?: AppointmentStatus;
	@IsOptional() @IsDateString() scheduledAt?: string;
	@IsOptional() @IsString() notes?: string;
}

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all appointments (filterable)" })
	@ApiQuery({ name: "status", required: false })
	@ApiQuery({ name: "doctorId", required: false })
	@ApiQuery({ name: "from", required: false })
	@ApiQuery({ name: "to", required: false })
	@ApiQuery({ name: "limit", required: false, description: "Max results (default 50, max 200)" })
	@ApiQuery({ name: "offset", required: false, description: "Skip this many results (default 0)" })
	async findAll(
		@Query("status") status?: string,
		@Query("doctorId") doctorId?: string,
		@Query("from") from?: string,
		@Query("to") to?: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: ApptWithAll[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);
		const where: Record<string, unknown> = {};
		if (status) where["status"] = status;
		if (doctorId) where["doctorId"] = doctorId;
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

	@Get("stats")
	@ApiOperation({ summary: "Get aggregate appointment stats across all appointments" })
	async getStats(): Promise<{ data: AppointmentStats }> {
		const now = new Date();
		const todayStart = new Date(now);
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date(now);
		todayEnd.setHours(23, 59, 59, 999);

		const [all, todayCount, upcomingCount] = await Promise.all([
			this.prisma.appointment.groupBy({
				by: ["status"],
				_count: { id: true },
			}),
			this.prisma.appointment.count({
				where: { scheduledAt: { gte: todayStart, lte: todayEnd } },
			}),
			this.prisma.appointment.count({
				where: { scheduledAt: { gt: todayEnd }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
			}),
		]);

		const byStatus = { SCHEDULED: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 } as Record<AppointmentStatus, number>;
		for (const row of all) byStatus[row.status as AppointmentStatus] = row._count.id;

		return {
			data: {
				todayCount,
				upcomingCount,
				completedCount: byStatus.COMPLETED,
				cancelledCount: byStatus.CANCELLED,
				totalCount: all.reduce((s, r) => s + r._count.id, 0),
				byStatus,
			},
		};
	}

	@Get(":id")
	@ApiOperation({ summary: "Get appointment detail" })
	async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<{ data: ApptWithAll }> {
		const appointment = await this.prisma.appointment.findUnique({
			where: { id },
			include: {
				patient: { include: { user: true } },
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
			},
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		return { data: appointment };
	}

	@Get(":id/history")
	@ApiOperation({ summary: "Get status change history for an appointment" })
	async getHistory(@Param("id", ParseUUIDPipe) id: string): Promise<{ data: EnrichedStatusChange[] }> {
		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");

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

	@Post()
	@ApiOperation({ summary: "Create a new appointment" })
	async create(
		@Body() dto: CreateAppointmentDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithAll; message: string }> {
		// Validate that the referenced patient and doctor exist and are not soft-deleted
		const [patient, doctor] = await Promise.all([
			this.prisma.patient.findFirst({ where: { id: dto.patientId, user: { deletedAt: null } } }),
			this.prisma.doctor.findFirst({ where: { id: dto.doctorId, user: { deletedAt: null } } }),
		]);
		if (!patient) throw new NotFoundException("Patient not found");
		if (!doctor) throw new NotFoundException("Doctor not found");

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { assistant: true },
		});

		const appointment = await this.prisma.appointment.create({
			data: {
				patientId: dto.patientId,
				doctorId: dto.doctorId,
				assistantId: dbUser?.assistant?.id ?? null,
				scheduledAt: new Date(dto.scheduledAt),
				notes: dto.notes,
				status: "SCHEDULED",
			},
			include: {
				patient: { include: { user: true } },
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
			},
		});

		await this.prisma.appointmentStatusChange.create({
			data: {
				appointmentId: appointment.id,
				previousStatus: null,
				newStatus: "SCHEDULED",
				changedByKeycloakId: user.sub,
			},
		});

		return { data: appointment, message: "Appointment created" };
	}

	@Put(":id")
	@ApiOperation({ summary: "Update an appointment (reschedule or change status)" })
	async update(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateAppointmentDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: ApptWithAll }> {
		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");

		if (dto.status && dto.status !== appointment.status) {
			const allowed = ALLOWED_TRANSITIONS[appointment.status as AppointmentStatus];
			if (!allowed.includes(dto.status)) {
				throw new BadRequestException(
					`Cannot transition from ${appointment.status} to ${dto.status}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`
				);
			}
		}

		const updated = await this.prisma.appointment.update({
			where: { id },
			data: {
				...(dto.status && { status: dto.status }),
				...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
				...(dto.notes !== undefined && { notes: dto.notes }),
			},
			include: {
				patient: { include: { user: true } },
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
			},
		});

		if (dto.status && dto.status !== appointment.status) {
			await this.prisma.appointmentStatusChange.create({
				data: {
					appointmentId: id,
					previousStatus: appointment.status,
					newStatus: dto.status,
					changedByKeycloakId: user.sub,
				},
			});
		}

		return { data: updated };
	}

	@Delete(":id")
	@ApiOperation({ summary: "Cancel an appointment" })
	async cancel(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: Appointment; message: string }> {
		const appointment = await this.prisma.appointment.findUnique({ where: { id } });
		if (!appointment) throw new NotFoundException("Appointment not found");

		const allowed = ALLOWED_TRANSITIONS[appointment.status as AppointmentStatus];
		if (!allowed.includes("CANCELLED")) {
			throw new BadRequestException(`Cannot cancel an appointment with status ${appointment.status}`);
		}

		const updated = await this.prisma.appointment.update({
			where: { id },
			data: { status: "CANCELLED" },
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
}
