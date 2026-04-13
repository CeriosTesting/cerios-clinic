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
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

class CreateReviewDto {
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@IsOptional()
	@IsString()
	comment?: string;
}

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReviewsController {
	constructor(private readonly prisma: PrismaService) {}

	@Post("appointments/:appointmentId/reviews")
	@ApiOperation({ summary: "Create a review for a completed appointment" })
	async create(
		@Param("appointmentId", ParseUUIDPipe) appointmentId: string,
		@Body() dto: CreateReviewDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown; message: string }> {
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
			include: {
				doctor: { include: { user: true } },
			},
		});

		return { data: review, message: "Review submitted successfully" };
	}

	@Get("appointments/:appointmentId/reviews")
	@ApiOperation({ summary: "Get review for a specific appointment" })
	async getForAppointment(
		@Param("appointmentId", ParseUUIDPipe) appointmentId: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown }> {
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
	async getDoctorReviews(
		@Param("doctorId", ParseUUIDPipe) doctorId: string
	): Promise<{ data: unknown[]; stats: { averageRating: number; totalReviews: number } }> {
		const reviews = await this.prisma.review.findMany({
			where: { doctorId },
			include: {
				patient: { include: { user: { select: { firstName: true, lastName: true } } } },
				appointment: { select: { scheduledAt: true } },
			},
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
