import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, IsOptional, IsDateString, Matches } from "class-validator";

import { PrismaService } from "../prisma/prisma.service";

import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { KeycloakTokenPayload } from "./jwt.strategy";
import { KeycloakAdminService } from "./keycloak-admin.service";

class RegisterDto {
	@IsEmail()
	email!: string;

	@IsString()
	firstName!: string;

	@IsString()
	lastName!: string;

	@IsString()
	@MinLength(8)
	password!: string;

	@IsString()
	@MinLength(8)
	confirmPassword!: string;

	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;

	@IsOptional()
	@IsString()
	@Matches(/^[+\d\s\-().]{7,20}$/, { message: "Invalid phone number" })
	phone?: string;
}

class ResendVerificationDto {
	@IsEmail()
	email!: string;
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

	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new patient account" })
	@ApiResponse({ status: 201, description: "Account created — verification email sent" })
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

	@Post("resend-verification")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Resend the email verification link for a patient account" })
	@ApiResponse({ status: 204, description: "Request accepted (response is intentionally opaque)" })
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
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Sync Keycloak patient user into local DB after first login" })
	async syncUser(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: unknown }> {
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
