import { MailService } from "@clinic/api-common";
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from "@nestjs/common";
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

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly keycloakAdmin: KeycloakAdminService,
		private readonly mail: MailService
	) {}

	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new patient account" })
	@ApiResponse({ status: 201, description: "Account created successfully" })
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

		// Send welcome email
		void this.mail.sendWelcome(dto.email, `${dto.firstName} ${dto.lastName}`);

		return { message: "Account created successfully" };
	}

	@Post("sync")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Sync Keycloak patient user into local DB after first login" })
	async syncUser(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: unknown }> {
		const dbUser = await this.prisma.user.upsert({
			where: { keycloakId: user.sub },
			update: { email: user.email, firstName: user.given_name, lastName: user.family_name },
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
