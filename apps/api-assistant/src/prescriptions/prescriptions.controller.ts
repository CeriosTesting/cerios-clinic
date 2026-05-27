import {
	AppointmentSummaryResponseDto,
	DoctorCoreResponseDto,
	PatientCoreResponseDto,
	PrescriptionItemResponseDto,
	PrescriptionRecordResponseDto,
	UserNameEmailResponseDto,
	UserNameResponseDto,
} from "@clinic/api-common";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

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

type PrescriptionWithRelations = Prisma.PrescriptionGetPayload<{
	include: typeof PRESCRIPTION_INCLUDE;
}>;

class AssistantPrescriptionPatientResponseDto extends PatientCoreResponseDto {
	@ApiProperty({ type: () => UserNameEmailResponseDto })
	user!: UserNameEmailResponseDto;
}

class AssistantPrescriptionDoctorResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class AssistantPrescriptionResponseDto extends PrescriptionRecordResponseDto {
	@ApiProperty({ type: () => PrescriptionItemResponseDto, isArray: true })
	items!: PrescriptionItemResponseDto[];

	@ApiProperty({ type: () => AssistantPrescriptionPatientResponseDto })
	patient!: AssistantPrescriptionPatientResponseDto;

	@ApiProperty({ type: () => AssistantPrescriptionDoctorResponseDto })
	doctor!: AssistantPrescriptionDoctorResponseDto;

	@ApiProperty({ type: () => AppointmentSummaryResponseDto })
	appointment!: AppointmentSummaryResponseDto;
}

class AssistantPrescriptionListResponseDto {
	@ApiProperty({ type: () => AssistantPrescriptionResponseDto, isArray: true })
	data!: AssistantPrescriptionResponseDto[];

	@ApiProperty({ example: 42 })
	total!: number;
}

class AssistantPrescriptionDetailResponseDto {
	@ApiProperty({ type: () => AssistantPrescriptionResponseDto })
	data!: AssistantPrescriptionResponseDto;
}

@ApiTags("prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant")
@Controller("prescriptions")
export class PrescriptionsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all recent prescriptions" })
	@ApiOkResponse({ type: AssistantPrescriptionListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findAll(
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: PrescriptionWithRelations[]; total: number }> {
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
	@ApiOkResponse({ type: AssistantPrescriptionListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findByPatient(
		@Param("patientId", ParseUUIDPipe) patientId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: PrescriptionWithRelations[]; total: number }> {
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
	@ApiOkResponse({ type: AssistantPrescriptionListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findByDoctor(
		@Param("doctorId", ParseUUIDPipe) doctorId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: PrescriptionWithRelations[]; total: number }> {
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
	@ApiOkResponse({ type: AssistantPrescriptionDetailResponseDto })
	async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<{ data: PrescriptionWithRelations }> {
		const prescription = await this.prisma.prescription.findUnique({
			where: { id },
			include: PRESCRIPTION_INCLUDE,
		});
		if (!prescription) throw new NotFoundException("Prescription not found");

		return { data: prescription };
	}
}
