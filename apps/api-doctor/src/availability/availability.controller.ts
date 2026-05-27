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
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiProperty,
	ApiPropertyOptional,
	ApiTags,
} from "@nestjs/swagger";
import { DoctorUnavailability } from "@prisma/client";
import { IsDateString, IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

class CreateUnavailabilityDto {
	@ApiProperty({ format: "date-time", example: "2026-06-20T09:00:00.000Z" })
	@IsDateString()
	startDate!: string;

	@ApiProperty({ format: "date-time", example: "2026-06-20T12:00:00.000Z" })
	@IsDateString()
	endDate!: string;

	@ApiPropertyOptional({ example: "Medical conference" })
	@IsOptional()
	@IsString()
	reason?: string;
}

class DoctorUnavailabilityResponseDto {
	@ApiProperty({ format: "uuid", example: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" })
	id!: string;

	@ApiProperty({ format: "uuid", example: "7d444840-9dc0-11d1-b245-5ffdce74fad2" })
	doctorId!: string;

	@ApiProperty({ format: "date-time", example: "2026-06-20T09:00:00.000Z" })
	startDate!: string;

	@ApiProperty({ format: "date-time", example: "2026-06-20T12:00:00.000Z" })
	endDate!: string;

	@ApiPropertyOptional({ nullable: true, example: "Medical conference" })
	reason?: string | null;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;
}

class DoctorUnavailabilityListResponseDto {
	@ApiProperty({ type: () => DoctorUnavailabilityResponseDto, isArray: true })
	data!: DoctorUnavailabilityResponseDto[];
}

class DoctorUnavailabilityMutationResponseDto {
	@ApiProperty({ type: () => DoctorUnavailabilityResponseDto })
	data!: DoctorUnavailabilityResponseDto;

	@ApiProperty({ example: "Unavailability block created" })
	message!: string;
}

class DoctorAvailabilityMessageResponseDto {
	@ApiProperty({ example: "Unavailability block deleted" })
	message!: string;
}

@ApiTags("availability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("availability")
export class AvailabilityController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get all unavailability blocks for the current doctor" })
	@ApiOkResponse({ type: DoctorUnavailabilityListResponseDto })
	async findAll(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: DoctorUnavailability[] }> {
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
	@ApiCreatedResponse({ type: DoctorUnavailabilityMutationResponseDto })
	async create(
		@Body() dto: CreateUnavailabilityDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: DoctorUnavailability; message: string }> {
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

		// Cannot block time that has already passed
		if (startDate <= new Date()) {
			throw new BadRequestException("Cannot block time in the past");
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
	@ApiOkResponse({ type: DoctorAvailabilityMessageResponseDto })
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
