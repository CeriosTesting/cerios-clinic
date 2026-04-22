import { Controller, Get, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("profile")
export class ProfileController {
	constructor(private readonly prisma: PrismaService) {}

	@Get("me")
	@ApiOperation({ summary: "Get current doctor profile" })
	async getMe(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: UserWithDoctor }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");
		return { data: dbUser };
	}
}
