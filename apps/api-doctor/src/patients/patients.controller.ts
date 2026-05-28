import {
	DoctorCoreResponseDto,
	PatientCoreResponseDto,
	UserCoreResponseDto,
	ASSISTANT_ID_API_PROPERTY,
} from "@clinic/api-common";
import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
	NotFoundException,
	ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

type PatientWithAppointments = Prisma.PatientGetPayload<{
	include: {
		user: true;
		appointments: {
			include: { doctor: { include: { user: true } } };
		};
	};
}>;

class DoctorPatientAppointmentDoctorResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserCoreResponseDto })
	user!: UserCoreResponseDto;
}

class DoctorPatientAppointmentResponseDto {
	@ApiProperty({ format: "uuid", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "c56a4180-65aa-42ec-a945-5fd21dec0538" })
	patientId!: string;

	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	doctorId!: string;

	@ApiPropertyOptional(ASSISTANT_ID_API_PROPERTY)
	assistantId?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-06-15T09:30:00.000Z" })
	scheduledAt!: string;

	@ApiProperty({ enum: ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"], example: "COMPLETED" })
	status!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Follow-up consultation" })
	notes?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;

	@ApiProperty({ type: () => DoctorPatientAppointmentDoctorResponseDto })
	doctor!: DoctorPatientAppointmentDoctorResponseDto;
}

class DoctorPatientUserResponseDto extends UserCoreResponseDto {}

class DoctorPatientDetailResponseDto extends PatientCoreResponseDto {
	@ApiProperty({ type: () => DoctorPatientUserResponseDto })
	user!: DoctorPatientUserResponseDto;

	@ApiProperty({ type: () => DoctorPatientAppointmentResponseDto, isArray: true })
	appointments!: DoctorPatientAppointmentResponseDto[];
}

class DoctorPatientDetailWrapperDto {
	@ApiProperty({ type: () => DoctorPatientDetailResponseDto })
	data!: DoctorPatientDetailResponseDto;
}

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("patients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("patients")
export class PatientsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get(":id")
	@ApiOperation({ summary: "Get patient details (for doctors who have an appointment with this patient)" })
	@ApiOkResponse({ type: DoctorPatientDetailWrapperDto })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: PatientWithAppointments }> {
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
