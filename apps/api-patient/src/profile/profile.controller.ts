import { PatientCoreResponseDto, UserCoreResponseDto } from "@clinic/api-common";
import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Patch,
	Put,
	Body,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOkResponse,
	ApiOperation,
	ApiProperty,
	ApiPropertyOptional,
	ApiTags,
} from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsString, IsOptional, IsDateString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const PHONE_REGEX = /^[+\d\s\-().]{7,20}$/;

class UpdateProfileDto {
	@ApiPropertyOptional({ example: "Taylor" })
	@IsOptional()
	@IsString()
	firstName?: string;
	@ApiPropertyOptional({ example: "Brooks" })
	@IsOptional()
	@IsString()
	lastName?: string;
	@ApiPropertyOptional({ format: "date", example: "1990-01-15" })
	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;
	@ApiPropertyOptional({ example: "+31 6 1234 5678" })
	@IsOptional()
	@IsString()
	phone?: string;
	@ApiPropertyOptional({ example: "INS-2026-001" })
	@IsOptional()
	@IsString()
	insuranceNumber?: string;
}

type UserWithPatient = Prisma.UserGetPayload<{ include: { patient: true } }>;

class ProfileFeatureToggleMapResponseDto {
	@ApiProperty({
		type: Object,
		additionalProperties: { type: "boolean" },
		example: {
			[FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_FRONTEND]: false,
			[FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_BACKEND]: true,
		},
	})
	data!: Record<string, boolean>;
}

class PatientProfileResponseDto extends UserCoreResponseDto {
	@ApiProperty({ type: () => PatientCoreResponseDto })
	patient!: PatientCoreResponseDto;
}

class PatientProfileWrapperDto {
	@ApiProperty({ type: () => PatientProfileResponseDto })
	data!: PatientProfileResponseDto;
}

class PatientProfilePhotoDataDto {
	@ApiProperty({ example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..." })
	photo!: string;
}

class PatientProfilePhotoResponseDto {
	@ApiProperty({ type: () => PatientProfilePhotoDataDto })
	data!: PatientProfilePhotoDataDto;
}

function isInvalidDateOfBirth(dateOfBirth: string): boolean {
	const dob = new Date(dateOfBirth);
	return isNaN(dob.getTime()) || dob >= new Date();
}

function validateProfileDto(dto: UpdateProfileDto): string[] {
	const errors: string[] = [];
	if (dto.firstName !== undefined && (dto.firstName.trim().length === 0 || dto.firstName.length > 50)) {
		errors.push("First name is required and must be at most 50 characters");
	}
	if (dto.lastName !== undefined && (dto.lastName.trim().length === 0 || dto.lastName.length > 50)) {
		errors.push("Last name is required and must be at most 50 characters");
	}
	if (dto.phone !== undefined && dto.phone !== "" && !PHONE_REGEX.test(dto.phone)) {
		errors.push("Invalid phone number format");
	}
	if (dto.dateOfBirth !== undefined && dto.dateOfBirth !== "" && isInvalidDateOfBirth(dto.dateOfBirth)) {
		errors.push("Date of birth must be a valid date in the past");
	}
	if (dto.insuranceNumber !== undefined && dto.insuranceNumber.length > 30) {
		errors.push("Insurance number must be at most 30 characters");
	}
	return errors;
}

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller("profile")
export class ProfileController {
	constructor(private readonly prisma: PrismaService) {}

	@Get("feature-toggles")
	@ApiOperation({ summary: "Get profile-related feature toggle states" })
	@ApiOkResponse({ type: ProfileFeatureToggleMapResponseDto })
	async getFeatureToggles(): Promise<{ data: Record<string, boolean> }> {
		const keys = [FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_FRONTEND, FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_BACKEND];
		const toggles = await this.prisma.featureToggle.findMany({ where: { key: { in: keys } } }).catch(() => []);
		const result: Record<string, boolean> = {};
		for (const t of toggles) {
			result[t.key] = t.enabled;
		}
		return { data: result };
	}

	@Get()
	@ApiOperation({ summary: "Get current patient profile" })
	@ApiOkResponse({ type: PatientProfileWrapperDto })
	async getProfile(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: UserWithPatient }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser) throw new NotFoundException("User not found");
		return { data: dbUser };
	}

	@Put()
	@ApiOperation({ summary: "Update current patient profile" })
	@ApiOkResponse({ type: PatientProfileWrapperDto })
	async updateProfile(
		@CurrentUser() user: KeycloakTokenPayload,
		@Body() dto: UpdateProfileDto
	): Promise<{ data: UserWithPatient }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser) throw new NotFoundException("User not found");

		const { firstName, lastName, dateOfBirth, phone, insuranceNumber } = dto;

		// Conditional validation — skipped when the bug toggle is enabled
		const validationToggle = await this.prisma.featureToggle
			.findUnique({ where: { key: FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_BACKEND } })
			.catch(() => null);

		if (!validationToggle?.enabled) {
			const errors = validateProfileDto(dto);
			if (errors.length > 0) {
				throw new BadRequestException(errors);
			}
		}

		const updatedUser = await this.prisma.user.update({
			where: { id: dbUser.id },
			data: {
				...(firstName && { firstName }),
				...(lastName && { lastName }),
				patient: {
					update: {
						...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
						...(phone !== undefined && { phone }),
						...(insuranceNumber !== undefined && { insuranceNumber }),
					},
				},
			},
			include: { patient: true },
		});
		return { data: updatedUser };
	}

	@Patch("photo")
	@ApiOperation({ summary: "Upload profile photo (1 MB max, JPEG/PNG/WebP)" })
	@ApiConsumes("multipart/form-data")
	@ApiOkResponse({ type: PatientProfilePhotoResponseDto })
	@ApiBody({
		schema: {
			type: "object",
			properties: { photo: { type: "string", format: "binary" } },
		},
	})
	@UseInterceptors(FileInterceptor("photo", { limits: { fileSize: MAX_FILE_BYTES } }))
	async uploadPhoto(
		@CurrentUser() user: KeycloakTokenPayload,
		@UploadedFile() file: { mimetype: string; size: number; buffer: Buffer }
	): Promise<{ data: { photo: string } }> {
		if (!file) throw new BadRequestException("No file uploaded");
		if (!ALLOWED_MIME.has(file.mimetype)) {
			throw new BadRequestException("Only JPEG, PNG, or WebP images are allowed");
		}
		if (file.size > MAX_FILE_BYTES) {
			throw new BadRequestException("File exceeds 1 MB limit");
		}

		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient not found");

		const photo = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
		await this.prisma.patient.update({
			where: { id: dbUser.patient.id },
			data: { photo },
		});

		return { data: { photo } };
	}
}
