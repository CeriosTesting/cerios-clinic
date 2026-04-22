import {
	Controller,
	Get,
	Post,
	Put,
	Param,
	ParseUUIDPipe,
	Body,
	Query,
	UseGuards,
	NotFoundException,
	BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, IsOptional, IsArray, ValidateNested, IsUUID } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

class PrescriptionItemDto {
	@IsString() medicationName!: string;
	@IsString() dosage!: string;
	@IsString() frequency!: string;
	@IsString() duration!: string;
	@IsOptional() @IsString() instructions?: string;
}

class CreatePrescriptionDto {
	@IsUUID() appointmentId!: string;
	@IsOptional() @IsString() notes?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PrescriptionItemDto)
	items!: PrescriptionItemDto[];
}

class UpdatePrescriptionDto {
	@IsOptional() @IsString() notes?: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PrescriptionItemDto)
	items?: PrescriptionItemDto[];
}

const PRESCRIPTION_INCLUDE = {
	items: true,
	patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
	appointment: { select: { scheduledAt: true, status: true } },
} as const;

@ApiTags("prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("prescriptions")
export class PrescriptionsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get prescriptions created by the current doctor" })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "offset", required: false })
	async findAll(
		@CurrentUser() user: KeycloakTokenPayload,
		@Query("limit") limitRaw?: string,
		@Query("offset") offsetRaw?: string
	): Promise<{ data: unknown[]; total: number }> {
		const take = Math.min(Number(limitRaw) || 50, 200);
		const skip = Math.max(Number(offsetRaw) || 0, 0);

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const where = { doctorId: dbUser.doctor.id };
		const [prescriptions, total] = await Promise.all([
			this.prisma.prescription.findMany({
				where,
				include: PRESCRIPTION_INCLUDE,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.prescription.count({ where }),
		]);

		return { data: prescriptions, total };
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a prescription by ID" })
	async findOne(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const prescription = await this.prisma.prescription.findUnique({
			where: { id },
			include: PRESCRIPTION_INCLUDE,
		});
		if (!prescription) throw new NotFoundException("Prescription not found");
		if (prescription.doctorId !== dbUser.doctor.id) {
			throw new BadRequestException("Access denied");
		}

		return { data: prescription };
	}

	@Post()
	@ApiOperation({ summary: "Create a prescription for a completed appointment" })
	async create(
		@Body() dto: CreatePrescriptionDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown; message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const appointment = await this.prisma.appointment.findUnique({
			where: { id: dto.appointmentId },
		});
		if (!appointment) throw new NotFoundException("Appointment not found");
		if (appointment.doctorId !== dbUser.doctor.id) {
			throw new BadRequestException("This appointment does not belong to you");
		}
		if (appointment.status !== "COMPLETED") {
			throw new BadRequestException("Prescriptions can only be created for completed appointments");
		}

		// Check if prescription already exists for this appointment
		const existing = await this.prisma.prescription.findUnique({
			where: { appointmentId: dto.appointmentId },
		});
		if (existing) {
			throw new BadRequestException("A prescription already exists for this appointment");
		}

		if (!dto.items || dto.items.length === 0) {
			throw new BadRequestException("At least one prescription item is required");
		}

		const prescription = await this.prisma.prescription.create({
			data: {
				appointmentId: dto.appointmentId,
				patientId: appointment.patientId,
				doctorId: dbUser.doctor.id,
				notes: dto.notes,
				items: {
					create: dto.items.map(item => ({
						medicationName: item.medicationName,
						dosage: item.dosage,
						frequency: item.frequency,
						duration: item.duration,
						instructions: item.instructions,
					})),
				},
			},
			include: PRESCRIPTION_INCLUDE,
		});

		return { data: prescription, message: "Prescription created" };
	}

	@Put(":id")
	@ApiOperation({ summary: "Update a prescription (replaces items if provided)" })
	async update(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdatePrescriptionDto,
		@CurrentUser() user: KeycloakTokenPayload
	): Promise<{ data: unknown; message: string }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const prescription = await this.prisma.prescription.findUnique({
			where: { id },
		});
		if (!prescription) throw new NotFoundException("Prescription not found");
		if (prescription.doctorId !== dbUser.doctor.id) {
			throw new BadRequestException("Access denied");
		}

		const updated = await this.prisma.$transaction(async tx => {
			if (dto.items) {
				// Delete existing items and recreate
				await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
				await tx.prescriptionItem.createMany({
					data: dto.items.map(item => ({
						prescriptionId: id,
						medicationName: item.medicationName,
						dosage: item.dosage,
						frequency: item.frequency,
						duration: item.duration,
						instructions: item.instructions,
					})),
				});
			}

			return tx.prescription.update({
				where: { id },
				data: { ...(dto.notes !== undefined && { notes: dto.notes }) },
				include: PRESCRIPTION_INCLUDE,
			});
		});

		return { data: updated, message: "Prescription updated" };
	}
}
