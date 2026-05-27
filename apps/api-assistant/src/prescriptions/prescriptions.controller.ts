import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const PRESCRIPTION_INCLUDE = {
	items: true,
	patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
	doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true, status: true } },
} as const;

@ApiTags("prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant")
@Controller("prescriptions")
export class PrescriptionsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all recent prescriptions" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findAll(
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const [prescriptions, total] = await Promise.all([
			this.prisma.prescription.findMany({
				include: PRESCRIPTION_INCLUDE,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.prescription.count(),
		]);

		return { data: prescriptions, total };
	}

	@Get("patient/:patientId")
	@ApiOperation({ summary: "Get prescriptions for a specific patient" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findByPatient(
		@Param("patientId", ParseUUIDPipe) patientId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
		if (!patient) throw new NotFoundException("Patient not found");

		const where = { patientId };
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

	@Get("doctor/:doctorId")
	@ApiOperation({ summary: "Get prescriptions by a specific doctor" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findByDoctor(
		@Param("doctorId", ParseUUIDPipe) doctorId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
		if (!doctor) throw new NotFoundException("Doctor not found");

		const where = { doctorId };
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
	async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<{ data: unknown }> {
		const prescription = await this.prisma.prescription.findUnique({
			where: { id },
			include: PRESCRIPTION_INCLUDE,
		});
		if (!prescription) throw new NotFoundException("Prescription not found");

		return { data: prescription };
	}
}
