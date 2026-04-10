import { AppointmentStatus } from "@clinic/shared-types";
import {
	Controller,
	Get,
	Patch,
	Param,
	UseGuards,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

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

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get current patient's appointments" })
	async findAll(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: ApptWithDoctorAssistant[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointments = await this.prisma.appointment.findMany({
			where: { patientId: dbUser.patient.id },
			include: {
				doctor: { include: { user: true } },
				assistant: { include: { user: true } },
			},
			orderBy: { scheduledAt: "asc" },
		});
		return { data: appointments };
	}

	@Get("history")
	@ApiOperation({ summary: "Get current patient's completed appointment history" })
	async getHistory(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: ApptWithDoctorOnly[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointments = await this.prisma.appointment.findMany({
			where: { patientId: dbUser.patient.id, status: "COMPLETED" },
			include: {
				doctor: { include: { user: true } },
			},
			orderBy: { scheduledAt: "desc" },
		});
		return { data: appointments };
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a specific appointment (must belong to current patient)" })
	async findOne(@Param("id") id: string, @CurrentUser() user: KeycloakTokenPayload): Promise<{ data: ApptWithAll }> {
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
		@Param("id") id: string,
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
}
