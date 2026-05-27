import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
	NotFoundException,
	ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const PRESCRIPTION_INCLUDE = {
	items: true,
	doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true, status: true } },
} as const;

@ApiTags("prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller("prescriptions")
export class PrescriptionsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get current patient's prescriptions" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const where = { patientId: dbUser.patient.id };
		const [prescriptions, total] = await Promise.all([
			this.prisma.prescription.findMany({
				where,
				include: PRESCRIPTION_INCLUDE,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.prescription.count({ where }),
		]);

		return { data: prescriptions, total };
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a specific prescription" })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const prescription = await this.prisma.prescription.findUnique({
			where: { id },
			include: PRESCRIPTION_INCLUDE,
		});
		if (!prescription) throw new NotFoundException("Prescription not found");
		if (prescription.patientId !== dbUser.patient.id) {
			throw new ForbiddenException("Access denied");
		}

		return { data: prescription };
	}
}
