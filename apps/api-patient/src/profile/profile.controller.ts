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
import { ApiBody, ApiConsumes, ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsString, IsOptional, IsDateString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const PHONE_REGEX = /^[+\d\s\-().]{7,20}$/;

class UpdateProfileDto {
	@IsOptional() @IsString() firstName?: string;
	@IsOptional() @IsString() lastName?: string;
	@IsOptional() @IsDateString() dateOfBirth?: string;
	@IsOptional() @IsString() phone?: string;
	@IsOptional() @IsString() insuranceNumber?: string;
}

type UserWithPatient = Prisma.UserGetPayload<{ include: { patient: true } }>;

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
	constructor(private readonly prisma: PrismaService) {}

	@Get("feature-toggles")
	@ApiOperation({ summary: "Get profile-related feature toggle states" })
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
			const errors: string[] = [];
			if (firstName !== undefined && (firstName.trim().length === 0 || firstName.length > 50)) {
				errors.push("First name is required and must be at most 50 characters");
			}
			if (lastName !== undefined && (lastName.trim().length === 0 || lastName.length > 50)) {
				errors.push("Last name is required and must be at most 50 characters");
			}
			if (phone !== undefined && phone !== "" && !PHONE_REGEX.test(phone)) {
				errors.push("Invalid phone number format");
			}
			if (dateOfBirth !== undefined && dateOfBirth !== "") {
				const dob = new Date(dateOfBirth);
				if (isNaN(dob.getTime()) || dob >= new Date()) {
					errors.push("Date of birth must be a valid date in the past");
				}
			}
			if (insuranceNumber !== undefined && insuranceNumber.length > 30) {
				errors.push("Insurance number must be at most 30 characters");
			}
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
