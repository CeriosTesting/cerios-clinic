import {
	AppointmentDateResponseDto,
	DoctorCoreResponseDto,
	PatientCoreResponseDto,
	ReviewRecordResponseDto,
	ReviewStatsResponseDto,
	UserNameResponseDto,
} from "@clinic/api-common";
import { Controller, Get, Param, ParseUUIDPipe, UseGuards, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

const REVIEW_INCLUDE_ALL = {
	patient: { include: { user: { select: { firstName: true, lastName: true } } } },
	doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true } },
} as const;

const REVIEW_INCLUDE_PATIENT = {
	patient: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true } },
} as const;

const REVIEW_INCLUDE_DOCTOR = {
	doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true } },
} as const;

type AssistantReviewWithAll = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE_ALL }>;
type AssistantDoctorReview = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE_PATIENT }>;
type AssistantPatientReview = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE_DOCTOR }>;

class AssistantReviewPatientResponseDto extends PatientCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class AssistantReviewDoctorResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class AssistantReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => AssistantReviewPatientResponseDto })
	patient!: AssistantReviewPatientResponseDto;

	@ApiProperty({ type: () => AssistantReviewDoctorResponseDto })
	doctor!: AssistantReviewDoctorResponseDto;

	@ApiProperty({ type: () => AppointmentDateResponseDto })
	appointment!: AppointmentDateResponseDto;
}

class AssistantDoctorReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => AssistantReviewPatientResponseDto })
	patient!: AssistantReviewPatientResponseDto;

	@ApiProperty({ type: () => AppointmentDateResponseDto })
	appointment!: AppointmentDateResponseDto;
}

class AssistantPatientReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => AssistantReviewDoctorResponseDto })
	doctor!: AssistantReviewDoctorResponseDto;

	@ApiProperty({ type: () => AppointmentDateResponseDto })
	appointment!: AppointmentDateResponseDto;
}

class AssistantReviewListResponseDto {
	@ApiProperty({ type: () => AssistantReviewResponseDto, isArray: true })
	data!: AssistantReviewResponseDto[];

	@ApiProperty({ type: () => ReviewStatsResponseDto })
	stats!: ReviewStatsResponseDto;

	@ApiProperty({ example: 42 })
	total!: number;
}

class AssistantDoctorReviewListResponseDto {
	@ApiProperty({ type: () => AssistantDoctorReviewResponseDto, isArray: true })
	data!: AssistantDoctorReviewResponseDto[];

	@ApiProperty({ type: () => ReviewStatsResponseDto })
	stats!: ReviewStatsResponseDto;

	@ApiProperty({ example: 18 })
	total!: number;
}

class AssistantPatientReviewListResponseDto {
	@ApiProperty({ type: () => AssistantPatientReviewResponseDto, isArray: true })
	data!: AssistantPatientReviewResponseDto[];
}

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant")
@Controller("reviews")
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all recent reviews" })
	@ApiOkResponse({ type: AssistantReviewListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async findAll(
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{
		data: AssistantReviewWithAll[];
		stats: { averageRating: number; totalReviews: number };
		total: number;
	}> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const [reviews, total, stats] = await Promise.all([
			this.prisma.review.findMany({
				include: REVIEW_INCLUDE_ALL,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.review.count(),
			this.prisma.review.aggregate({
				_avg: { rating: true },
				_count: { id: true },
			}),
		]);

		return {
			data: reviews,
			stats: {
				averageRating: stats._avg.rating ?? 0,
				totalReviews: stats._count.id,
			},
			total,
		};
	}

	@Get("doctor/:doctorId")
	@ApiOperation({ summary: "Get reviews for a specific doctor" })
	@ApiOkResponse({ type: AssistantDoctorReviewListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async getDoctorReviews(
		@Param("doctorId", ParseUUIDPipe) doctorId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: AssistantDoctorReview[]; stats: { averageRating: number; totalReviews: number }; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const [reviews, total, stats] = await Promise.all([
			this.prisma.review.findMany({
				where: { doctorId },
				include: REVIEW_INCLUDE_PATIENT,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.review.count({ where: { doctorId } }),
			this.prisma.review.aggregate({
				where: { doctorId },
				_avg: { rating: true },
				_count: { id: true },
			}),
		]);

		return {
			data: reviews,
			stats: {
				averageRating: stats._avg.rating ?? 0,
				totalReviews: stats._count.id,
			},
			total,
		};
	}

	@Get("patient/:patientId")
	@ApiOperation({ summary: "Get reviews by a specific patient" })
	@ApiOkResponse({ type: AssistantPatientReviewListResponseDto })
	async getPatientReviews(
		@Param("patientId", ParseUUIDPipe) patientId: string
	): Promise<{ data: AssistantPatientReview[] }> {
		const reviews = await this.prisma.review.findMany({
			where: { patientId },
			include: REVIEW_INCLUDE_DOCTOR,
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return { data: reviews };
	}
}
