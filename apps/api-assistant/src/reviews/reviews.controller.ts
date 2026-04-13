import { Controller, Get, Param, ParseUUIDPipe, UseGuards, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reviews")
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all recent reviews" })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "offset", required: false })
	async findAll(
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; stats: { averageRating: number; totalReviews: number }; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const [reviews, total, stats] = await Promise.all([
			this.prisma.review.findMany({
				include: {
					patient: { include: { user: { select: { firstName: true, lastName: true } } } },
					doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
					appointment: { select: { scheduledAt: true } },
				},
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
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "offset", required: false })
	async getDoctorReviews(
		@Param("doctorId", ParseUUIDPipe) doctorId: string,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; stats: { averageRating: number; totalReviews: number }; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const [reviews, total, stats] = await Promise.all([
			this.prisma.review.findMany({
				where: { doctorId },
				include: {
					patient: { include: { user: { select: { firstName: true, lastName: true } } } },
					appointment: { select: { scheduledAt: true } },
				},
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
	async getPatientReviews(@Param("patientId", ParseUUIDPipe) patientId: string): Promise<{ data: unknown[] }> {
		const reviews = await this.prisma.review.findMany({
			where: { patientId },
			include: {
				doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
				appointment: { select: { scheduledAt: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return { data: reviews };
	}
}
