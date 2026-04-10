import { ALLOWED_TRANSITIONS, AppointmentStatus } from "@clinic/shared-types";
import {
	Controller,
	Get,
	Put,
	Param,
	Body,
	Query,
	UseGuards,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { Prisma, AppointmentStatusChange } from "@prisma/client";
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
	@IsEnum(["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"])
	status?: AppointmentStatus;

	@IsOptional() @IsString() notes?: string;
	@IsOptional() @IsDateString() scheduledAt?: string;
}

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get doctor's appointments (filterable)" })
	@ApiQuery({ name: "status", required: false })
	@ApiQuery({ name: "from", required: false })
	@ApiQuery({ name: "to", required: false })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("status") status?: string,
		@Query("from") from?: string,
		@Query("to") to?: string
	): Promise<{ data: ApptWithPatientAssistant[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const where: Record<string, unknown> = { doctorId: dbUser.doctor.id };
		if (status) where["status"] = status;
		if (from || to) {
			where["scheduledAt"] = {
				...(from && { gte: new Date(from) }),
				...(to && { lte: new Date(to) }),
			};
		}

		const appointments = await this.prisma.appointment.findMany({
			where,
			include: {
				patient: { include: { user: true } },
				assistant: { include: { user: true } },
			},
			orderBy: { scheduledAt: "asc" },
		});
		return { data: appointments };
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
	async findOne(@Param("id") id: string, @CurrentUser() user: KeycloakTokenPayload): Promise<{ data: ApptWithAll }> {
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
		@Param("id") id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: EnrichedStatusChange[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub },
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
		@Param("id") id: string,
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
}
