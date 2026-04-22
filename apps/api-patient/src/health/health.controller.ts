import { Public } from "@clinic/api-common";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Public()
@Controller("health")
export class HealthController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	liveness(): { status: string; service: string; timestamp: string } {
		return {
			status: "ok",
			service: "api-patient",
			timestamp: new Date().toISOString(),
		};
	}

	@Get("ready")
	async readiness(): Promise<{ status: string; service: string; timestamp: string }> {
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			return {
				status: "ready",
				service: "api-patient",
				timestamp: new Date().toISOString(),
			};
		} catch {
			throw new ServiceUnavailableException({
				status: "unready",
				service: "api-patient",
				reason: "database_unavailable",
			});
		}
	}
}
