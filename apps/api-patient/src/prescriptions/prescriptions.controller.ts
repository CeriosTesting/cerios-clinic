import {
	AppointmentSummaryResponseDto,
	DoctorCoreResponseDto,
	PrescriptionItemResponseDto,
	PrescriptionRecordResponseDto,
	UserNameResponseDto,
} from "@clinic/api-common";
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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

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

type PrescriptionWithRelations = Prisma.PrescriptionGetPayload<{
	include: typeof PRESCRIPTION_INCLUDE;
}>;

class PatientPrescriptionDoctorResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class PatientPrescriptionResponseDto extends PrescriptionRecordResponseDto {
	@ApiProperty({ type: () => PrescriptionItemResponseDto, isArray: true })
	items!: PrescriptionItemResponseDto[];

	@ApiProperty({ type: () => PatientPrescriptionDoctorResponseDto })
	doctor!: PatientPrescriptionDoctorResponseDto;

	@ApiProperty({ type: () => AppointmentSummaryResponseDto })
	appointment!: AppointmentSummaryResponseDto;
}

class PatientPrescriptionListResponseDto {
	@ApiProperty({ type: () => PatientPrescriptionResponseDto, isArray: true })
	data!: PatientPrescriptionResponseDto[];

	@ApiProperty({ example: 42 })
	total!: number;
}

class PatientPrescriptionDetailResponseDto {
	@ApiProperty({ type: () => PatientPrescriptionResponseDto })
	data!: PatientPrescriptionResponseDto;
}

@ApiTags("prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller("prescriptions")
export class PrescriptionsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get current patient's prescriptions" })
	@ApiOkResponse({ type: PatientPrescriptionListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: PrescriptionWithRelations[]; total: number }> {
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
	@ApiOkResponse({ type: PatientPrescriptionDetailResponseDto })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: PrescriptionWithRelations }> {
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
