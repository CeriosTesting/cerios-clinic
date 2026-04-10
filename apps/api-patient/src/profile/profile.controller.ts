import { Controller, Get, Put, Body, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsString, IsOptional, IsDateString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

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
}
