import {
	AppointmentDateResponseDto,
	DoctorCoreResponseDto,
	PatientCoreResponseDto,
	ReviewRecordResponseDto,
	ReviewStatsResponseDto,
	UserCoreResponseDto,
	UserNameResponseDto,
} from "@clinic/api-common";
import {
	Controller,
	Post,
	Get,
	Param,
	Body,
	ParseUUIDPipe,
	UseGuards,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiProperty,
	ApiPropertyOptional,
	ApiTags,
} from "@nestjs/swagger";
import { Prisma, Review } from "@prisma/client";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

class CreateReviewDto {
	@ApiProperty({ minimum: 1, maximum: 5, example: 5 })
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@ApiPropertyOptional({ example: "Very clear explanation and punctual consultation." })
	@IsOptional()
	@IsString()
	comment?: string;
}

const REVIEW_CREATE_INCLUDE = {
	doctor: { include: { user: true } },
} as const;

const REVIEW_LIST_INCLUDE = {
	patient: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true } },
} as const;

type CreatedReviewWithDoctor = Prisma.ReviewGetPayload<{ include: typeof REVIEW_CREATE_INCLUDE }>;
type DoctorReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_LIST_INCLUDE }>;

class PatientReviewDoctorResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserCoreResponseDto })
	user!: UserCoreResponseDto;
}

class PatientCreatedReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => PatientReviewDoctorResponseDto })
	doctor!: PatientReviewDoctorResponseDto;
}

class PatientAppointmentReviewResponseDto extends ReviewRecordResponseDto {}

class PatientDoctorReviewPatientResponseDto extends PatientCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class PatientDoctorReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => PatientDoctorReviewPatientResponseDto })
	patient!: PatientDoctorReviewPatientResponseDto;

	@ApiProperty({ type: () => AppointmentDateResponseDto })
	appointment!: AppointmentDateResponseDto;
}

class PatientReviewMutationResponseDto {
	@ApiProperty({ type: () => PatientCreatedReviewResponseDto })
	data!: PatientCreatedReviewResponseDto;

	@ApiProperty({ example: "Review submitted successfully" })
	message!: string;
}

class PatientAppointmentReviewWrapperDto {
	@ApiProperty({ type: () => PatientAppointmentReviewResponseDto, nullable: true })
	data!: PatientAppointmentReviewResponseDto | null;
}

class PatientDoctorReviewListResponseDto {
	@ApiProperty({ type: () => PatientDoctorReviewResponseDto, isArray: true })
	data!: PatientDoctorReviewResponseDto[];

	@ApiProperty({ type: () => ReviewStatsResponseDto })
	stats!: ReviewStatsResponseDto;
}

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller()
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Post("appointments/:appointmentId/reviews")
	@ApiOperation({ summary: "Create a review for a completed appointment" })
	@ApiCreatedResponse({ type: PatientReviewMutationResponseDto })
	async create(
		@Param("appointmentId", ParseUUIDPipe) appointmentId: string,
		@Body() dto: CreateReviewDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: CreatedReviewWithDoctor; message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointment = await this.prisma.appointment.findUnique({
			where: { id: appointmentId },
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.patientId !== dbUser.patient.id) throw new ForbiddenException("Access denied");
		if (appointment.status !== "COMPLETED") {
			throw new BadRequestException("You can only review completed appointments");
		}

		// Check if already reviewed
		const existing = await this.prisma.review.findUnique({
			where: { appointmentId },
		});
		if (existing) {
			throw new BadRequestException("You have already reviewed this appointment");
		}

		const review = await this.prisma.review.create({
			data: {
				appointmentId,
				patientId: dbUser.patient.id,
				doctorId: appointment.doctorId,
				rating: dto.rating,
				comment: dto.comment,
			},
			include: REVIEW_CREATE_INCLUDE,
		});

		return { data: review, message: "Review submitted successfully" };
	}

	@Get("appointments/:appointmentId/reviews")
	@ApiOperation({ summary: "Get review for a specific appointment" })
	@ApiOkResponse({ type: PatientAppointmentReviewWrapperDto })
	async getForAppointment(
		@Param("appointmentId", ParseUUIDPipe) appointmentId: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: Review | null }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const appointment = await this.prisma.appointment.findUnique({
			where: { id: appointmentId },
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.patientId !== dbUser.patient.id) throw new ForbiddenException("Access denied");

		const review = await this.prisma.review.findUnique({
			where: { appointmentId },
		});

		return { data: review };
	}

	@Get("doctors/:doctorId/reviews")
	@ApiOperation({ summary: "Get reviews for a doctor" })
	@ApiOkResponse({ type: PatientDoctorReviewListResponseDto })
	async getDoctorReviews(
		@Param("doctorId", ParseUUIDPipe) doctorId: string
	): Promise<{ data: DoctorReviewWithRelations[]; stats: { averageRating: number; totalReviews: number } }> {
		const reviews = await this.prisma.review.findMany({
			where: { doctorId },
			include: REVIEW_LIST_INCLUDE,
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		const stats = await this.prisma.review.aggregate({
			where: { doctorId },
			_avg: { rating: true },
			_count: { id: true },
		});

		return {
			data: reviews,
			stats: {
				averageRating: stats._avg.rating ?? 0,
				totalReviews: stats._count.id,
			},
		};
	}
}
