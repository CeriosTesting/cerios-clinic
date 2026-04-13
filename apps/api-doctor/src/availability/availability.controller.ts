import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	ParseUUIDPipe,
	UseGuards,
	NotFoundException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

class CreateUnavailabilityDto {
	@IsDateString()
	startDate!: string;

	@IsDateString()
	endDate!: string;

	@IsOptional()
	@IsString()
	reason?: string;
}

@ApiTags("availability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("availability")
export class AvailabilityController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all unavailability blocks for the current doctor" })
	async findAll(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: unknown[] }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const blocks = await this.prisma.doctorUnavailability.findMany({
			where: { doctorId: dbUser.doctor.id },
			orderBy: { startDate: "asc" },
		});

		return { data: blocks };
	}

	@Post()
	@ApiOperation({ summary: "Add a new unavailability block" })
	async create(
		@Body() dto: CreateUnavailabilityDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown; message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const startDate = new Date(dto.startDate);
		const endDate = new Date(dto.endDate);

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			throw new BadRequestException("Invalid date format");
		}

		if (endDate <= startDate) {
			throw new BadRequestException("End date must be after start date");
		}

		// Cannot block past dates
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		if (startDate < today) {
			throw new BadRequestException("Cannot block dates in the past");
		}

		// Check for overlapping blocks
		const overlap = await this.prisma.doctorUnavailability.findFirst({
			where: {
				doctorId: dbUser.doctor.id,
				startDate: { lt: endDate },
				endDate: { gt: startDate },
			},
		});
		if (overlap) {
			throw new BadRequestException("This period overlaps with an existing unavailability block");
		}

		const block = await this.prisma.doctorUnavailability.create({
			data: {
				doctorId: dbUser.doctor.id,
				startDate,
				endDate,
				reason: dto.reason,
			},
		});

		return { data: block, message: "Unavailability block created" };
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete an unavailability block" })
	async remove(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const block = await this.prisma.doctorUnavailability.findUnique({
			where: { id },
		});
		if (!block) throw new NotFoundException("Unavailability block not found");
		if (block.doctorId !== dbUser.doctor.id) {
			throw new BadRequestException("Access denied");
		}

		await this.prisma.doctorUnavailability.delete({ where: { id } });

		return { message: "Unavailability block deleted" };
	}
}
