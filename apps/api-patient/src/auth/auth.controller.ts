import { PatientCoreResponseDto, Public } from "@clinic/api-common";
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Logger } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiProperty,
	ApiPropertyOptional,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsEmail, IsString, MinLength, IsOptional, IsDateString, Matches } from "class-validator";

import { PrismaService } from "../prisma/prisma.service";

import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { KeycloakTokenPayload } from "./jwt.strategy";
import { KeycloakAdminService } from "./keycloak-admin.service";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

class RegisterDto {
	@ApiProperty({ format: "email", example: "patient@example.com" })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: "Taylor" })
	@IsString()
	firstName!: string;

	@ApiProperty({ example: "Brooks" })
	@IsString()
	lastName!: string;

	@ApiProperty({ minLength: 8, example: "StrongPass123", writeOnly: true })
	@IsString()
	@MinLength(8)
	password!: string;

	@ApiProperty({ minLength: 8, example: "StrongPass123", writeOnly: true })
	@IsString()
	@MinLength(8)
	confirmPassword!: string;

	@ApiPropertyOptional({ format: "date", example: "1990-01-15" })
	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;

	@ApiPropertyOptional({ example: "+31 6 1234 5678" })
	@IsOptional()
	@IsString()
	@Matches(/^[+\d\s\-().]{7,20}$/, { message: "Invalid phone number" })
	phone?: string;
}

class ResendVerificationDto {
	@ApiProperty({ format: "email", example: "patient@example.com" })
	@IsEmail()
	email!: string;
}

type SyncedUser = Omit<Prisma.UserGetPayload<{ include: { patient: true } }>, "keycloakId" | "deletedAt">;

class AuthMessageResponseDto {
	@ApiProperty({ example: "Account created. Please check your email to verify your address before signing in." })
	message!: string;
}

class SyncedUserResponseDto {
	@ApiProperty({ format: "uuid", example: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" })
	id!: string;

	@ApiProperty({ format: "email", example: "patient@example.com" })
	email!: string;

	@ApiProperty({ example: "Taylor" })
	firstName!: string;

	@ApiProperty({ example: "Brooks" })
	lastName!: string;

	@ApiProperty({ enum: ["patient", "doctor", "assistant", "admin"], example: "patient" })
	role!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ format: "date-time", example: "2026-05-28T09:30:00.000Z" })
	updatedAt!: string;

	@ApiProperty({ type: () => PatientCoreResponseDto })
	patient!: PatientCoreResponseDto;
}

class SyncedUserWrapperResponseDto {
	@ApiProperty({ type: () => SyncedUserResponseDto })
	data!: SyncedUserResponseDto;
}

// Minimum seconds between resend-verification attempts for the same email.
// Intentionally in-memory: this is a test/demo app, not a production throttle.
const RESEND_THROTTLE_SECONDS = 60;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	private readonly logger = new Logger(AuthController.name);
	private readonly resendLastSent = new Map<string, number>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly keycloakAdmin: KeycloakAdminService
	) {}

	@Public()
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new patient account" })
	@ApiCreatedResponse({ type: AuthMessageResponseDto, description: "Account created — verification email sent" })
	@ApiResponse({ status: 409, description: "Email already registered" })
	async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
		if (dto.password !== dto.confirmPassword) {
			throw new BadRequestException("Passwords do not match");
		}

		const keycloakId = await this.keycloakAdmin.createPatient({
			email: dto.email,
			firstName: dto.firstName,
			lastName: dto.lastName,
			password: dto.password,
		});

		try {
			await this.prisma.user.upsert({
				where: { keycloakId },
				update: {
					email: dto.email,
					firstName: dto.firstName,
					lastName: dto.lastName,
				},
				create: {
					keycloakId,
					email: dto.email,
					firstName: dto.firstName,
					lastName: dto.lastName,
					role: "patient",
					patient: {
						create: {
							dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
							phone: dto.phone ?? null,
						},
					},
				},
			});
		} catch (err) {
			// DB write failed — disable the Keycloak user to avoid an orphaned account
			await this.keycloakAdmin.disableUser(keycloakId).catch(() => undefined);
			throw err;
		}

		// Trigger Keycloak to send the verification email. If this fails we still
		// keep the account (user can use resend-verification), so swallow errors.
		try {
			await this.keycloakAdmin.sendVerifyEmail(keycloakId);
			this.resendLastSent.set(dto.email.toLowerCase(), Date.now());
		} catch (err) {
			this.logger.warn(`Verification email send failed for ${dto.email}: ${(err as Error).message}`);
		}

		return { message: "Account created. Please check your email to verify your address before signing in." };
	}

	@Public()
	@Post("resend-verification")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Resend the email verification link for a patient account" })
	@ApiNoContentResponse({ description: "Request accepted (response is intentionally opaque)" })
	async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
		const email = dto.email.trim().toLowerCase();

		// Per-email throttle. Return 204 regardless so callers can't probe timing.
		const last = this.resendLastSent.get(email);
		if (last && Date.now() - last < RESEND_THROTTLE_SECONDS * 1000) {
			return;
		}
		this.resendLastSent.set(email, Date.now());

		const user = await this.keycloakAdmin.findUserByEmail(email);
		if (!user || user.emailVerified) {
			// Don't reveal whether the email exists or is already verified.
			return;
		}

		try {
			await this.keycloakAdmin.sendVerifyEmail(user.id);
		} catch (err) {
			this.logger.warn(`Resend verification failed for ${email}: ${(err as Error).message}`);
		}
	}

	@Post("sync")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles("patient")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Sync Keycloak patient user into local DB after first login" })
	@ApiOkResponse({ type: SyncedUserWrapperResponseDto })
	async syncUser(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: SyncedUser }> {
		// Only seed firstName/lastName from the Keycloak token on first login (create).
		// On subsequent syncs, preserve any profile edits the patient has made in the portal;
		// otherwise each visit to the home page would overwrite the DB with the token values.
		const dbUser = await this.prisma.user.upsert({
			where: { keycloakId: user.sub },
			update: { email: user.email },
			create: {
				keycloakId: user.sub,
				email: user.email,
				firstName: user.given_name,
				lastName: user.family_name,
				role: "patient",
				patient: { create: {} },
			},
			include: { patient: true },
		});
		const { keycloakId: _k, deletedAt: _d, ...safeUser } = dbUser;
		return { data: safeUser };
	}
}
