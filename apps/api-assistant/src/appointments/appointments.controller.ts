import { EventsService, MailService } from "@clinic/api-common";
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
	ConflictException,
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
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant")
@Controller("appointments")
export class AppointmentsController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mail: MailService,
		private readonly events: EventsService
	) {}

	@Get()
	@ApiOperation({ summary: "Get all appointments (filterable)" })
	@ApiQuery({ name: "status", required: false })
	@ApiQuery({ name: "doctorId", required: false })
	@ApiQuery({ name: "from", required: false })
	@ApiQuery({ name: "to", required: false })
	@ApiQuery({ name: "search", required: false, description: "Search by patient or doctor name" })
	@ApiQuery({ name: "sortBy", required: false, description: "Sort field: date or patient" })
	@ApiQuery({ name: "sortOrder", required: false, description: "Sort direction: asc or desc" })
	@ApiQuery({ name: "limit", required: false, description: "Max results (default 50, max 200)" })
	@ApiQuery({ name: "offset", required: false, description: "Skip this many results (default 0)" })
	async findAll(
		@Query("status") status?: string,
		@Query("doctorId") doctorId?: string,
		@Query("from") from?: string,
		@Query("to") to?: string,
		@Query("search") search?: string,
		@Query("sortBy") sortByRaw?: string,
		@Query("sortOrder") sortOrderRaw?: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: ApptWithAll[]; total: number }> {
		const { take, skip } = this.getPagination(limitRaw, offsetRaw);
		const orderBy = this.getAppointmentsOrderBy(sortByRaw, sortOrderRaw);
		const where = this.getAppointmentsWhere({ status, doctorId, from, to, search });

		const [appointments, total] = await Promise.all([
			this.prisma.appointment.findMany({
				where,
				include: {
					patient: { include: { user: true } },
					doctor: { include: { user: true } },
					assistant: { include: { user: true } },
				},
				orderBy,
				take,
				skip,
			}),
			this.prisma.appointment.count({ where }),
		]);
		return { data: appointments, total };
	}

	private getPagination(limitRaw?: string, offsetRaw?: string): { take: number; skip: number } {
		return {
			take: Math.min(Number(limitRaw) || 50, 200),
			skip: Math.max(Number(offsetRaw) || 0, 0),
		};
	}

	private getAppointmentsOrderBy(
		sortByRaw?: string,
		sortOrderRaw?: string
	): Prisma.AppointmentOrderByWithRelationInput[] {
		const sortBy = sortByRaw === "patient" ? "patient" : "date";
		const sortOrder: Prisma.SortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
		if (sortBy === "patient") {
			return [
				{ patient: { user: { lastName: sortOrder } } },
				{ patient: { user: { firstName: sortOrder } } },
				{ scheduledAt: sortOrder },
				{ id: sortOrder },
			];
		}
		return [{ scheduledAt: sortOrder }, { id: sortOrder }];
	}

	private getAppointmentsWhere(filters: {
		status?: string;
		doctorId?: string;
		from?: string;
		to?: string;
		search?: string;
	}): Prisma.AppointmentWhereInput {
		const { status, doctorId, from, to, search } = filters;
		const where: Prisma.AppointmentWhereInput = {};
		if (status) where.status = status as AppointmentStatusEnum;
		if (doctorId) where.doctorId = doctorId;
		if (from || to) {
			if (from && isNaN(new Date(from).getTime())) throw new BadRequestException("Invalid 'from' date");
			if (to && isNaN(new Date(to).getTime())) throw new BadRequestException("Invalid 'to' date");
			where.scheduledAt = {
				...(from && { gte: new Date(from) }),
				...(to && { lte: new Date(to) }),
			};
		}
		const trimmedSearch = search?.trim();
		if (trimmedSearch) {
			const tokens = trimmedSearch.split(/\s+/).filter(Boolean);
			const mode: Prisma.QueryMode = "insensitive";
			const tokenClause = (token: string): Prisma.AppointmentWhereInput => ({
				OR: [
					{ patient: { user: { firstName: { contains: token, mode } } } },
					{ patient: { user: { lastName: { contains: token, mode } } } },
					{ doctor: { user: { firstName: { contains: token, mode } } } },
					{ doctor: { user: { lastName: { contains: token, mode } } } },
				],
			});
			where.AND = tokens.map(tokenClause);
		}
		return where;
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

		const scheduledAt = this.normalizeScheduledAt(new Date(dto.scheduledAt));
		await this.ensureNoConflict(scheduledAt, dto.doctorId, dto.patientId);
		await this.ensureDoctorAvailable(scheduledAt, dto.doctorId);

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { assistant: true },
		});

		const appointment = await this.createAppointmentOrConflict({
			patientId: dto.patientId,
			doctorId: dto.doctorId,
			assistantId: dbUser?.assistant?.id ?? null,
			scheduledAt,
			notes: dto.notes,
		});

		await this.prisma.appointmentStatusChange.create({
			data: {
				appointmentId: appointment.id,
				previousStatus: null,
				newStatus: "SCHEDULED",
				changedByKeycloakId: user.sub,
			},
		});

		// Send confirmation email to patient
		const patientUser = appointment.patient?.user;
		const doctorUser = appointment.doctor?.user;
		if (patientUser && doctorUser) {
			const patientName = `${patientUser.firstName} ${patientUser.lastName}`;
			const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
			void this.mail.sendAppointmentConfirmation(patientUser.email, patientName, doctorName, appointment.scheduledAt);
		}

		this.events.emitAppointmentEvent({
			type: "appointment.created",
			appointmentId: appointment.id,
			patientId: appointment.patientId,
			doctorId: appointment.doctorId,
			status: appointment.status,
			scheduledAt: appointment.scheduledAt.toISOString(),
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

		this.validateStatusTransition(dto, appointment);

		const rescheduled = dto.scheduledAt ? this.normalizeScheduledAt(new Date(dto.scheduledAt)) : null;
		if (rescheduled) {
			if (rescheduled.getTime() !== appointment.scheduledAt.getTime()) {
				await this.ensureNoConflict(rescheduled, appointment.doctorId, appointment.patientId, id);
				await this.ensureDoctorAvailable(rescheduled, appointment.doctorId);
			}
		}

		const updated = await this.updateAppointmentOrConflict(id, {
			...(dto.status && { status: dto.status }),
			...(rescheduled && { scheduledAt: rescheduled }),
			...(dto.notes !== undefined && { notes: dto.notes }),
		});

		if (dto.status && dto.status !== appointment.status) {
			await this.recordStatusChangeAndNotify(id, appointment.status, dto.status, user.sub, updated);
		}

		return { data: updated };
	}

	private async createAppointmentOrConflict(
		data: Omit<Prisma.AppointmentUncheckedCreateInput, "status">
	): Promise<ApptWithAll> {
		try {
			return await this.prisma.appointment.create({
				data: { ...data, status: "SCHEDULED" },
				include: {
					patient: { include: { user: true } },
					doctor: { include: { user: true } },
					assistant: { include: { user: true } },
				},
			});
		} catch (err) {
			throw this.mapUniqueConstraintError(err);
		}
	}

	private async updateAppointmentOrConflict(
		id: string,
		data: Prisma.AppointmentUncheckedUpdateInput
	): Promise<ApptWithAll> {
		try {
			return await this.prisma.appointment.update({
				where: { id },
				data,
				include: {
					patient: { include: { user: true } },
					doctor: { include: { user: true } },
					assistant: { include: { user: true } },
				},
			});
		} catch (err) {
			throw this.mapUniqueConstraintError(err);
		}
	}

	private mapUniqueConstraintError(err: unknown): unknown {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			const target = (err.meta?.["target"] as string | string[] | undefined) ?? "";
			const targetStr = Array.isArray(target) ? target.join(",") : target;
			if (targetStr.includes("doctor")) {
				return new ConflictException("This doctor already has an appointment at this time");
			}
			if (targetStr.includes("patient")) {
				return new ConflictException("This patient already has an appointment at this time");
			}
			return new ConflictException("Appointment conflict detected");
		}
		return err;
	}

	private normalizeScheduledAt(date: Date): Date {
		const d = new Date(date);
		d.setSeconds(0, 0);
		return d;
	}

	private async ensureNoConflict(
		scheduledAt: Date,
		doctorId: string,
		patientId: string,
		excludeAppointmentId?: string
	): Promise<void> {
		const conflict = await this.prisma.appointment.findFirst({
			where: {
				scheduledAt,
				status: { notIn: ["CANCELLED", "COMPLETED"] },
				OR: [{ doctorId }, { patientId }],
				...(excludeAppointmentId && { NOT: { id: excludeAppointmentId } }),
			},
			select: { id: true, doctorId: true, patientId: true },
		});
		if (conflict) {
			const reason =
				conflict.doctorId === doctorId && conflict.patientId === patientId
					? "This patient already has an appointment with this doctor at this time"
					: conflict.doctorId === doctorId
						? "This doctor already has an appointment at this time"
						: "This patient already has an appointment at this time";
			throw new ConflictException(reason);
		}
	}

	private async ensureDoctorAvailable(scheduledAt: Date, doctorId: string): Promise<void> {
		const block = await this.prisma.doctorUnavailability.findFirst({
			where: {
				doctorId,
				startDate: { lte: scheduledAt },
				endDate: { gt: scheduledAt },
			},
			select: { id: true },
		});
		if (block) {
			throw new ConflictException("The doctor is unavailable at the selected time");
		}
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
		previousStatus: AppointmentStatus,
		newStatus: AppointmentStatus,
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

	@Delete(":id")
	@ApiOperation({ summary: "Cancel an appointment" })
	async cancel(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: Appointment; message: string }> {
		const appointment = await this.prisma.appointment.findUnique({
			where: { id },
			include: {
				patient: { include: { user: true } },
				doctor: { include: { user: true } },
			},
		});
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

		// Send cancellation emails
		const patientUser = appointment.patient?.user;
		const doctorUser = appointment.doctor?.user;
		if (patientUser && doctorUser) {
			const patientName = `${patientUser.firstName} ${patientUser.lastName}`;
			const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
			void this.mail.sendAppointmentCancellation(
				patientUser.email,
				patientName,
				doctorName,
				patientName,
				appointment.scheduledAt
			);
			void this.mail.sendAppointmentCancellation(
				doctorUser.email,
				`Dr. ${doctorName}`,
				doctorName,
				patientName,
				appointment.scheduledAt
			);
		}

		this.events.emitAppointmentEvent({
			type: "appointment.cancelled",
			appointmentId: updated.id,
			patientId: updated.patientId,
			doctorId: updated.doctorId,
			status: "CANCELLED",
			scheduledAt: updated.scheduledAt.toISOString(),
		});

		return { data: updated, message: "Appointment cancelled" };
	}
}
