import { PrismaClient } from "@clinic/database";
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { requireEnv } from "./env";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor() {
		super({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }) });
	}

	async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}
