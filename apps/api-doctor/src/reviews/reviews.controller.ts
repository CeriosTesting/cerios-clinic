import {
	AppointmentDateResponseDto,
	PatientCoreResponseDto,
	ReviewRecordResponseDto,
	ReviewStatsResponseDto,
	UserNameResponseDto,
} from "@clinic/api-common";
import { Controller, Get, UseGuards, NotFoundException, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

const REVIEW_INCLUDE = {
	patient: { include: { user: { select: { firstName: true, lastName: true } } } },
	appointment: { select: { scheduledAt: true } },
} as const;

type DoctorReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

class DoctorReviewPatientResponseDto extends PatientCoreResponseDto {
	@ApiProperty({ type: () => UserNameResponseDto })
	user!: UserNameResponseDto;
}

class DoctorReviewResponseDto extends ReviewRecordResponseDto {
	@ApiProperty({ type: () => DoctorReviewPatientResponseDto })
	patient!: DoctorReviewPatientResponseDto;

	@ApiProperty({ type: () => AppointmentDateResponseDto })
	appointment!: AppointmentDateResponseDto;
}

class DoctorReviewListResponseDto {
	@ApiProperty({ type: () => DoctorReviewResponseDto, isArray: true })
	data!: DoctorReviewResponseDto[];

	@ApiProperty({ type: () => ReviewStatsResponseDto })
	stats!: ReviewStatsResponseDto;

	@ApiProperty({ example: 18 })
	total!: number;
}

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("reviews")
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get reviews for the current doctor" })
	@ApiOkResponse({ type: DoctorReviewListResponseDto })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiQuery({ name: "offset", required: false, type: Number })
	async getMyReviews(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{
		data: DoctorReviewWithRelations[];
		stats: { averageRating: number; totalReviews: number };
		total: number;
	}> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const doctorId = dbUser.doctor.id;

		const [reviews, total, stats] = await Promise.all([
			this.prisma.review.findMany({
				where: { doctorId },
				include: REVIEW_INCLUDE,
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
}
