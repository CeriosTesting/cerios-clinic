import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("doctors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("doctors")
export class DoctorsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "List all active doctors (for patient reference)" })
	async findAll(): Promise<{ data: unknown }> {
		const doctors = await this.prisma.doctor.findMany({
			where: { user: { deletedAt: null } },
			include: { user: { select: { id: true, firstName: true, lastName: true } } },
			orderBy: { user: { lastName: "asc" } },
		});

		return {
			data: doctors.map(d => ({
				id: d.id,
				userId: d.userId,
				specialization: d.specialization,
				firstName: d.user.firstName,
				lastName: d.user.lastName,
			})),
		};
	}
}
