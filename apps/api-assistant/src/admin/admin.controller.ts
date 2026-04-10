import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	UseGuards,
	NotFoundException,
	ConflictException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsString, IsEmail, IsOptional, MinLength } from "class-validator";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

import { KeycloakAdminService } from "./keycloak-admin.service";

class CreateDoctorDto {
	@IsEmail() email: string;
	@IsString() firstName: string;
	@IsString() lastName: string;
	@IsOptional() @IsString() specialization?: string;
	@IsOptional() @IsString() licenseNumber?: string;
	@IsString() @MinLength(8) password: string;
}

class UpdateDoctorDto {
	@IsOptional() @IsString() firstName?: string;
	@IsOptional() @IsString() lastName?: string;
	@IsOptional() @IsString() specialization?: string;
	@IsOptional() @IsString() licenseNumber?: string;
}

class CreateAssistantDto {
	@IsEmail() email: string;
	@IsString() firstName: string;
	@IsString() lastName: string;
	@IsOptional() @IsString() department?: string;
	@IsString() @MinLength(8) password: string;
}

class UpdateAssistantDto {
	@IsOptional() @IsString() firstName?: string;
	@IsOptional() @IsString() lastName?: string;
	@IsOptional() @IsString() department?: string;
}

type UserWithRelations = Prisma.UserGetPayload<{ include: { doctor: true; assistant: true } }>;
type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;
type UserWithAssistant = Prisma.UserGetPayload<{ include: { assistant: true } }>;
type DoctorWithUser = Prisma.DoctorGetPayload<{ include: { user: true } }>;
type AssistantWithUser = Prisma.AssistantGetPayload<{ include: { user: true } }>;

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin")
export class AdminController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly keycloakAdmin: KeycloakAdminService
	) {}

	@Get("users")
	@ApiOperation({ summary: "[Admin] List all staff" })
	async listUsers(): Promise<{ data: UserWithRelations[] }> {
		const users = await this.prisma.user.findMany({
			where: { role: { in: ["doctor", "assistant"] }, deletedAt: null },
			include: { doctor: true, assistant: true },
			orderBy: { createdAt: "desc" },
		});
		return { data: users };
	}

	@Post("doctors")
	@ApiOperation({ summary: "[Admin] Create doctor account" })
	async createDoctor(@Body() dto: CreateDoctorDto): Promise<{ data: UserWithDoctor; message: string }> {
		const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
		if (existing) throw new ConflictException("Email already in use");

		const keycloakId = await this.keycloakAdmin.createUser({
			email: dto.email,
			firstName: dto.firstName,
			lastName: dto.lastName,
			password: dto.password,
			roles: ["doctor"],
		});
		const user = await this.prisma.user.create({
			data: {
				keycloakId,
				email: dto.email,
				firstName: dto.firstName,
				lastName: dto.lastName,
				role: "doctor",
				doctor: { create: { specialization: dto.specialization, licenseNumber: dto.licenseNumber } },
			},
			include: { doctor: true },
		});
		return { data: user, message: "Doctor created" };
	}

	@Put("doctors/:id")
	@ApiOperation({ summary: "[Admin] Update doctor" })
	async updateDoctor(@Param("id") id: string, @Body() dto: UpdateDoctorDto): Promise<{ data: DoctorWithUser }> {
		const doctor = await this.prisma.doctor.findUnique({ where: { id }, include: { user: true } });
		if (!doctor) throw new NotFoundException("Doctor not found");

		if (dto.firstName || dto.lastName) {
			await this.keycloakAdmin.updateUser(doctor.user.keycloakId, dto);
		}
		const updated = await this.prisma.doctor.update({
			where: { id },
			data: {
				specialization: dto.specialization,
				licenseNumber: dto.licenseNumber,
				user: {
					update: {
						...(dto.firstName && { firstName: dto.firstName }),
						...(dto.lastName && { lastName: dto.lastName }),
					},
				},
			},
			include: { user: true },
		});
		return { data: updated };
	}

	@Delete("doctors/:id")
	@ApiOperation({ summary: "[Admin] Soft-delete doctor" })
	async deleteDoctor(@Param("id") id: string): Promise<{ message: string }> {
		const doctor = await this.prisma.doctor.findUnique({ where: { id }, include: { user: true } });
		if (!doctor) throw new NotFoundException("Doctor not found");
		await this.keycloakAdmin.disableUser(doctor.user.keycloakId);
		await this.prisma.user.update({ where: { id: doctor.userId }, data: { deletedAt: new Date() } });
		return { message: "Doctor disabled" };
	}

	@Post("assistants")
	@ApiOperation({ summary: "[Admin] Create assistant account" })
	async createAssistant(@Body() dto: CreateAssistantDto): Promise<{ data: UserWithAssistant; message: string }> {
		const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
		if (existing) throw new ConflictException("Email already in use");

		const keycloakId = await this.keycloakAdmin.createUser({
			email: dto.email,
			firstName: dto.firstName,
			lastName: dto.lastName,
			password: dto.password,
			roles: ["assistant"],
		});
		const user = await this.prisma.user.create({
			data: {
				keycloakId,
				email: dto.email,
				firstName: dto.firstName,
				lastName: dto.lastName,
				role: "assistant",
				assistant: { create: { department: dto.department } },
			},
			include: { assistant: true },
		});
		return { data: user, message: "Assistant created" };
	}

	@Put("assistants/:id")
	@ApiOperation({ summary: "[Admin] Update assistant" })
	async updateAssistant(
		@Param("id") id: string,
		@Body() dto: UpdateAssistantDto
	): Promise<{ data: AssistantWithUser }> {
		const assistant = await this.prisma.assistant.findUnique({ where: { id }, include: { user: true } });
		if (!assistant) throw new NotFoundException("Assistant not found");

		if (dto.firstName || dto.lastName) {
			await this.keycloakAdmin.updateUser(assistant.user.keycloakId, dto);
		}
		const updated = await this.prisma.assistant.update({
			where: { id },
			data: {
				department: dto.department,
				user: {
					update: {
						...(dto.firstName && { firstName: dto.firstName }),
						...(dto.lastName && { lastName: dto.lastName }),
					},
				},
			},
			include: { user: true },
		});
		return { data: updated };
	}

	@Delete("assistants/:id")
	@ApiOperation({ summary: "[Admin] Soft-delete assistant" })
	async deleteAssistant(@Param("id") id: string): Promise<{ message: string }> {
		const assistant = await this.prisma.assistant.findUnique({ where: { id }, include: { user: true } });
		if (!assistant) throw new NotFoundException("Assistant not found");
		await this.keycloakAdmin.disableUser(assistant.user.keycloakId);
		await this.prisma.user.update({ where: { id: assistant.userId }, data: { deletedAt: new Date() } });
		return { message: "Assistant disabled" };
	}
}
