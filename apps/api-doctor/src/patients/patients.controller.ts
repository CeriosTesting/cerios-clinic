import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
	NotFoundException,
	ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("patients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("patients")
export class PatientsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get(":id")
	@ApiOperation({ summary: "Get patient details (for doctors who have an appointment with this patient)" })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const hasRelationship =
			(await this.prisma.appointment.count({
				where: { doctorId: dbUser.doctor.id, patientId: id },
			})) > 0;
		if (!hasRelationship) throw new ForbiddenException("Access denied");

		const patient = await this.prisma.patient.findUnique({
			where: { id },
			include: {
				user: true,
				appointments: {
					where: { doctorId: dbUser.doctor.id },
					include: { doctor: { include: { user: true } } },
					orderBy: { scheduledAt: "desc" },
					take: 10,
				},
			},
		});
		if (!patient) throw new NotFoundException("Patient not found");
		return { data: patient };
	}
}
