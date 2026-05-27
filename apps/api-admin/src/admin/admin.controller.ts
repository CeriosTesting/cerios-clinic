import {
	AssistantCoreResponseDto,
	DoctorCoreResponseDto,
	MessageResponseDto,
	UserCoreResponseDto,
} from "@clinic/api-common";
import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	ParseUUIDPipe,
	UseGuards,
	NotFoundException,
	ConflictException,
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
import { Prisma } from "@prisma/client";
import { IsString, IsEmail, IsNotEmpty, IsOptional, MinLength } from "class-validator";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

import { KeycloakAdminService } from "./keycloak-admin.service";

class CreateDoctorDto {
	@ApiProperty({ format: "email", example: "doctor@example.com" })
	@IsEmail()
	email: string;
	@ApiProperty({ example: "Alice" })
	@IsString()
	@IsNotEmpty()
	firstName: string;
	@ApiProperty({ example: "Morgan" })
	@IsString()
	@IsNotEmpty()
	lastName: string;
	@ApiPropertyOptional({ example: "Cardiology" })
	@IsOptional()
	@IsString()
	specialization?: string;
	@ApiPropertyOptional({ example: "MED-12345" })
	@IsOptional()
	@IsString()
	licenseNumber?: string;
	@ApiProperty({ minLength: 8, example: "StrongPass123", writeOnly: true })
	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}

class UpdateDoctorDto {
	@ApiPropertyOptional({ example: "Alice" })
	@IsOptional()
	@IsString()
	firstName?: string;
	@ApiPropertyOptional({ example: "Morgan" })
	@IsOptional()
	@IsString()
	lastName?: string;
	@ApiPropertyOptional({ example: "Cardiology" })
	@IsOptional()
	@IsString()
	specialization?: string;
	@ApiPropertyOptional({ example: "MED-12345" })
	@IsOptional()
	@IsString()
	licenseNumber?: string;
}

class CreateAssistantDto {
	@ApiProperty({ format: "email", example: "assistant@example.com" })
	@IsEmail()
	email: string;
	@ApiProperty({ example: "Jamie" })
	@IsString()
	@IsNotEmpty()
	firstName: string;
	@ApiProperty({ example: "Lee" })
	@IsString()
	@IsNotEmpty()
	lastName: string;
	@ApiPropertyOptional({ example: "Front Desk" })
	@IsOptional()
	@IsString()
	department?: string;
	@ApiProperty({ minLength: 8, example: "StrongPass123", writeOnly: true })
	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}

class UpdateAssistantDto {
	@ApiPropertyOptional({ example: "Jamie" })
	@IsOptional()
	@IsString()
	firstName?: string;
	@ApiPropertyOptional({ example: "Lee" })
	@IsOptional()
	@IsString()
	lastName?: string;
	@ApiPropertyOptional({ example: "Front Desk" })
	@IsOptional()
	@IsString()
	department?: string;
}

type UserWithRelations = Prisma.UserGetPayload<{ include: { doctor: true; assistant: true } }>;
type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;
type DoctorWithUser = Prisma.DoctorGetPayload<{ include: { user: true } }>;
type UserWithAssistant = Prisma.UserGetPayload<{ include: { assistant: true } }>;
type AssistantWithUser = Prisma.AssistantGetPayload<{ include: { user: true } }>;

class AdminUserWithRelationsResponseDto extends UserCoreResponseDto {
	@ApiPropertyOptional({ type: () => DoctorCoreResponseDto, nullable: true })
	doctor?: DoctorCoreResponseDto | null;

	@ApiPropertyOptional({ type: () => AssistantCoreResponseDto, nullable: true })
	assistant?: AssistantCoreResponseDto | null;
}

class AdminUserWithDoctorResponseDto extends UserCoreResponseDto {
	@ApiProperty({ type: () => DoctorCoreResponseDto })
	doctor!: DoctorCoreResponseDto;
}

class AdminDoctorWithUserResponseDto extends DoctorCoreResponseDto {
	@ApiProperty({ type: () => UserCoreResponseDto })
	user!: UserCoreResponseDto;
}

class AdminUserWithAssistantResponseDto extends UserCoreResponseDto {
	@ApiProperty({ type: () => AssistantCoreResponseDto })
	assistant!: AssistantCoreResponseDto;
}

class AdminAssistantWithUserResponseDto extends AssistantCoreResponseDto {
	@ApiProperty({ type: () => UserCoreResponseDto })
	user!: UserCoreResponseDto;
}

class AdminUsersListResponseDto {
	@ApiProperty({ type: () => AdminUserWithRelationsResponseDto, isArray: true })
	data!: AdminUserWithRelationsResponseDto[];
}

class AdminDoctorCreateResponseDto {
	@ApiProperty({ type: () => AdminUserWithDoctorResponseDto })
	data!: AdminUserWithDoctorResponseDto;

	@ApiProperty({ example: "Doctor created successfully" })
	message!: string;
}

class AdminDoctorUpdateResponseDto {
	@ApiProperty({ type: () => AdminDoctorWithUserResponseDto })
	data!: AdminDoctorWithUserResponseDto;
}

class AdminAssistantCreateResponseDto {
	@ApiProperty({ type: () => AdminUserWithAssistantResponseDto })
	data!: AdminUserWithAssistantResponseDto;

	@ApiProperty({ example: "Assistant created successfully" })
	message!: string;
}

class AdminAssistantUpdateResponseDto {
	@ApiProperty({ type: () => AdminAssistantWithUserResponseDto })
	data!: AdminAssistantWithUserResponseDto;
}

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
	@ApiOperation({ summary: "[Admin] List all doctors and assistants" })
	@ApiOkResponse({ type: AdminUsersListResponseDto })
	async listUsers(): Promise<{ data: UserWithRelations[] }> {
		const users = await this.prisma.user.findMany({
			where: { role: { in: ["doctor", "assistant"] }, deletedAt: null },
			include: { doctor: true, assistant: true },
			orderBy: { createdAt: "desc" },
		});
		return { data: users };
	}

	@Post("doctors")
	@ApiOperation({ summary: "[Admin] Create a new doctor account" })
	@ApiCreatedResponse({ type: AdminDoctorCreateResponseDto })
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

		try {
			const user = await this.prisma.user.create({
				data: {
					keycloakId,
					email: dto.email,
					firstName: dto.firstName,
					lastName: dto.lastName,
					role: "doctor",
					doctor: {
						create: {
							specialization: dto.specialization,
							licenseNumber: dto.licenseNumber,
						},
					},
				},
				include: { doctor: true },
			});
			return { data: user, message: "Doctor created successfully" };
		} catch (err) {
			await this.keycloakAdmin.disableUser(keycloakId).catch(() => undefined);
			throw err;
		}
	}

	@Put("doctors/:id")
	@ApiOperation({ summary: "[Admin] Update a doctor" })
	@ApiOkResponse({ type: AdminDoctorUpdateResponseDto })
	async updateDoctor(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateDoctorDto
	): Promise<{ data: DoctorWithUser }> {
		const doctor = await this.prisma.doctor.findUnique({
			where: { id },
			include: { user: true },
		});
		if (!doctor) throw new NotFoundException("Doctor not found");

		if (dto.firstName || dto.lastName) {
			await this.keycloakAdmin.updateUser(doctor.user.keycloakId, {
				firstName: dto.firstName,
				lastName: dto.lastName,
			});
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
	@ApiOperation({ summary: "[Admin] Soft-delete a doctor (disables Keycloak account)" })
	@ApiOkResponse({ type: MessageResponseDto })
	async deleteDoctor(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
		const doctor = await this.prisma.doctor.findUnique({
			where: { id },
			include: { user: true },
		});
		if (!doctor) throw new NotFoundException("Doctor not found");

		await this.keycloakAdmin.disableUser(doctor.user.keycloakId);
		await this.prisma.user.update({
			where: { id: doctor.userId },
			data: { deletedAt: new Date() },
		});
		return { message: "Doctor account disabled successfully" };
	}

	@Post("assistants")
	@ApiOperation({ summary: "[Admin] Create a new assistant account" })
	@ApiCreatedResponse({ type: AdminAssistantCreateResponseDto })
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

		try {
			const user = await this.prisma.user.create({
				data: {
					keycloakId,
					email: dto.email,
					firstName: dto.firstName,
					lastName: dto.lastName,
					role: "assistant",
					assistant: {
						create: { department: dto.department },
					},
				},
				include: { assistant: true },
			});
			return { data: user, message: "Assistant created successfully" };
		} catch (err) {
			await this.keycloakAdmin.disableUser(keycloakId).catch(() => undefined);
			throw err;
		}
	}

	@Put("assistants/:id")
	@ApiOperation({ summary: "[Admin] Update an assistant" })
	@ApiOkResponse({ type: AdminAssistantUpdateResponseDto })
	async updateAssistant(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateAssistantDto
	): Promise<{ data: AssistantWithUser }> {
		const assistant = await this.prisma.assistant.findUnique({
			where: { id },
			include: { user: true },
		});
		if (!assistant) throw new NotFoundException("Assistant not found");

		if (dto.firstName || dto.lastName) {
			await this.keycloakAdmin.updateUser(assistant.user.keycloakId, {
				firstName: dto.firstName,
				lastName: dto.lastName,
			});
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
	@ApiOperation({ summary: "[Admin] Soft-delete an assistant (disables Keycloak account)" })
	@ApiOkResponse({ type: MessageResponseDto })
	async deleteAssistant(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
		const assistant = await this.prisma.assistant.findUnique({
			where: { id },
			include: { user: true },
		});
		if (!assistant) throw new NotFoundException("Assistant not found");

		await this.keycloakAdmin.disableUser(assistant.user.keycloakId);
		await this.prisma.user.update({
			where: { id: assistant.userId },
			data: { deletedAt: new Date() },
		});
		return { message: "Assistant account disabled successfully" };
	}
}
