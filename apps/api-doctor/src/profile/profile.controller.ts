import { DoctorCoreResponseDto, UserCoreResponseDto } from "@clinic/api-common";
import { Controller, Get, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;

class DoctorProfileResponseDto extends UserCoreResponseDto {
	@ApiProperty({ type: () => DoctorCoreResponseDto })
	doctor!: DoctorCoreResponseDto;
}

class DoctorProfileWrapperDto {
	@ApiProperty({ type: () => DoctorProfileResponseDto })
	data!: DoctorProfileResponseDto;
}

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("doctor")
@Controller("profile")
export class ProfileController {
	constructor(private readonly prisma: PrismaService) {}

	@Get("me")
	@ApiOperation({ summary: "Get current doctor profile" })
	@ApiOkResponse({ type: DoctorProfileWrapperDto })
	async getMe(@CurrentUser() user: KeycloakTokenPayload): Promise<{ data: UserWithDoctor }> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");
		return { data: dbUser };
	}
}
