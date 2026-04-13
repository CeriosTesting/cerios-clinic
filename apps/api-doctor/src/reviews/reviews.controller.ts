import { Controller, Get, UseGuards, NotFoundException, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reviews")
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get reviews for the current doctor" })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "offset", required: false })
	async getMyReviews(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; stats: { averageRating: number; totalReviews: number }; total: number }> {
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
}
