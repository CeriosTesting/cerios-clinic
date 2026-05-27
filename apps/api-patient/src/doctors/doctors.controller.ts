import { DoctorSlotAvailability } from "@clinic/shared-types";
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

/** Slot duration in minutes */
const SLOT_MINUTES = 30;
/** Working hours in UTC: 09:00 – 17:00 */
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

/** Returns all 30-min slot start times (as UTC hour/minute pairs) for one working day */
function buildDaySlots(): Array<{ hour: number; minute: number }> {
	const slots: Array<{ hour: number; minute: number }> = [];
	for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
		for (let m = 0; m < 60; m += SLOT_MINUTES) {
			slots.push({ hour: h, minute: m });
		}
	}
	return slots;
}

const DAY_SLOTS = buildDaySlots();

/** Returns true for Mon–Fri (UTC day-of-week) */
function isWeekday(date: Date): boolean {
	const dow = date.getUTCDay(); // 0=Sun, 6=Sat
	return dow >= 1 && dow <= 5;
}

/** Parses a YYYY-MM-DD string as a UTC midnight Date. Throws if invalid. */
function parseUTCDate(raw: string): Date {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		throw new BadRequestException(`Invalid date format "${raw}". Expected YYYY-MM-DD.`);
	}
	const d = new Date(`${raw}T00:00:00.000Z`);
	if (isNaN(d.getTime())) {
		throw new BadRequestException(`Invalid date "${raw}".`);
	}
	return d;
}

/** Returns today's UTC midnight Date */
function todayUTC(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
	async findAll(): Promise<{ data: unknown }> {
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
		if (!fromRaw || !toRaw) {
			throw new BadRequestException("Query params 'from' and 'to' are required.");
		}

		const fromDate = parseUTCDate(fromRaw);
		const toDate = parseUTCDate(toRaw);
		const tomorrow = new Date(todayUTC().getTime() + 86_400_000);

		if (fromDate < tomorrow) {
			throw new BadRequestException("'from' must be tomorrow or later.");
		}
		if (toDate < fromDate) {
			throw new BadRequestException("'to' must not be before 'from'.");
		}
		const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
		if (diffDays > 6) {
			throw new BadRequestException("Date range must not exceed 7 days.");
		}

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

		const bookedTimes = new Set(booked.map(a => a.scheduledAt.toISOString()));

		/** Returns true if a given slot time falls within any unavailability block */
		function isUnavailable(slotTime: Date): boolean {
			return unavailability.some(block => slotTime >= block.startDate && slotTime < block.endDate);
		}

		// Build availability grouped by date
		const result: DoctorSlotAvailability[] = [];
		const cursor = new Date(fromDate);

		while (cursor <= toDate) {
			if (isWeekday(cursor)) {
				const freeSlots: string[] = [];

				for (const { hour, minute } of DAY_SLOTS) {
					const slotUtc = new Date(
						Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), hour, minute, 0, 0)
					);
					if (!bookedTimes.has(slotUtc.toISOString()) && !isUnavailable(slotUtc)) {
						freeSlots.push(slotUtc.toISOString());
					}
				}

				result.push({
					date: cursor.toISOString().slice(0, 10),
					slots: freeSlots,
				});
			}
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}

		return { data: result };
	}
}
