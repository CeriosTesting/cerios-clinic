import { buildAvailableSlots, DoctorSlotAvailability, parseSlotRange } from "@clinic/shared-types";
import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiProperty,
	ApiPropertyOptional,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

type DoctorDirectoryItem = {
	id: string;
	userId: string;
	specialization: string | null;
	firstName: string;
	lastName: string;
	averageRating: number | null;
	reviewCount: number;
};

class DoctorDirectoryItemResponseDto {
	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" })
	userId!: string;

	@ApiPropertyOptional({ type: String, nullable: true, example: "Cardiology" })
	specialization?: string | null;

	@ApiProperty({ example: "Alex" })
	firstName!: string;

	@ApiProperty({ example: "Morgan" })
	lastName!: string;

	@ApiPropertyOptional({ type: Number, nullable: true, example: 4.7 })
	averageRating?: number | null;

	@ApiProperty({ example: 18 })
	reviewCount!: number;
}

class DoctorDirectoryListResponseDto {
	@ApiProperty({ type: () => DoctorDirectoryItemResponseDto, isArray: true })
	data!: DoctorDirectoryItemResponseDto[];
}

class DoctorSlotAvailabilityResponseDto {
	@ApiProperty({ example: "2026-06-20" })
	date!: string;

	@ApiProperty({ isArray: true, type: String, example: ["2026-06-20T09:00:00.000Z", "2026-06-20T09:30:00.000Z"] })
	slots!: string[];
}

class DoctorSlotAvailabilityListResponseDto {
	@ApiProperty({ type: () => DoctorSlotAvailabilityResponseDto, isArray: true })
	data!: DoctorSlotAvailabilityResponseDto[];
}

@ApiTags("doctors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller("doctors")
export class DoctorsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "List all active doctors (for patient reference)" })
	@ApiOkResponse({ type: DoctorDirectoryListResponseDto })
	async findAll(): Promise<{ data: DoctorDirectoryItem[] }> {
		const doctors = await this.prisma.doctor.findMany({
			where: { user: { deletedAt: null } },
			include: {
				user: { select: { id: true, firstName: true, lastName: true } },
				reviews: { select: { rating: true } },
			},
			orderBy: { user: { lastName: "asc" } },
		});

		return {
			data: doctors.map(d => {
				const ratings = d.reviews.map(r => r.rating);
				const avg = ratings.length > 0 ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
				return {
					id: d.id,
					userId: d.userId,
					specialization: d.specialization,
					firstName: d.user.firstName,
					lastName: d.user.lastName,
					averageRating: avg ? Math.round(avg * 10) / 10 : null,
					reviewCount: ratings.length,
				};
			}),
		};
	}

	@Get(":doctorId/slots")
	@ApiOperation({ summary: "Get available appointment slots for a doctor (future weekdays only)" })
	@ApiOkResponse({ type: DoctorSlotAvailabilityListResponseDto })
	@ApiQuery({
		name: "from",
		required: true,
		description: "Start date YYYY-MM-DD (must be tomorrow or later)",
		type: String,
	})
	@ApiQuery({ name: "to", required: true, description: "End date YYYY-MM-DD (max 7 days from from)", type: String })
	async getSlots(
		@Param("doctorId", ParseUUIDPipe) doctorId: string,
		@Query("from") fromRaw: string,
		@Query("to") toRaw: string
	): Promise<{ data: DoctorSlotAvailability[] }> {
		const range = parseSlotRange(fromRaw, toRaw);
		if (range.error !== undefined) throw new BadRequestException(range.error);
		const { from: fromDate, to: toDate } = range.value;

		// Verify doctor exists and is active
		const doctor = await this.prisma.doctor.findFirst({
			where: { id: doctorId, user: { deletedAt: null } },
		});
		if (!doctor) throw new NotFoundException("Doctor not found.");

		// Range for DB query: fromDate 00:00 UTC → toDate + 1 day 00:00 UTC (exclusive upper bound)
		const rangeEnd = new Date(toDate.getTime() + 86_400_000);

		// Fetch all non-CANCELLED bookings and unavailability blocks in the range
		const [booked, unavailability] = await Promise.all([
			this.prisma.appointment.findMany({
				where: {
					doctorId,
					status: { not: "CANCELLED" },
					scheduledAt: { gte: fromDate, lt: rangeEnd },
				},
				select: { scheduledAt: true },
			}),
			this.prisma.doctorUnavailability.findMany({
				where: {
					doctorId,
					startDate: { lt: rangeEnd },
					endDate: { gt: fromDate },
				},
			}),
		]);

		return {
			data: buildAvailableSlots({
				from: fromDate,
				to: toDate,
				booked: booked.map(a => a.scheduledAt),
				unavailable: unavailability,
			}),
		};
	}
}
