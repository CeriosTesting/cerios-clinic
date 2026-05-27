import { HealthResponseDto, Public } from "@clinic/api-common";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../prisma/prisma.service";

@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Liveness probe" })
	@ApiOkResponse({ type: HealthResponseDto })
	liveness(): { status: string; service: string; timestamp: string } {
		return {
			status: "ok",
			service: "api-doctor",
			timestamp: new Date().toISOString(),
		};
	}

	@Get("ready")
	@ApiOperation({ summary: "Readiness probe" })
	@ApiOkResponse({ type: HealthResponseDto })
	async readiness(): Promise<{ status: string; service: string; timestamp: string }> {
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			return {
				status: "ready",
				service: "api-doctor",
				timestamp: new Date().toISOString(),
			};
		} catch {
			throw new ServiceUnavailableException({
				status: "unready",
				service: "api-doctor",
				reason: "database_unavailable",
			});
		}
	}
}
