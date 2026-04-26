import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { type FeatureToggle, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FeatureTogglesService implements OnModuleInit {
	constructor(private readonly prisma: PrismaService) {}

	async onModuleInit(): Promise<void> {
		await this.seed();
	}

	async findAll(): Promise<FeatureToggle[]> {
		return this.prisma.featureToggle.findMany({
			orderBy: { key: "asc" },
		});
	}

	async findByKey(key: string): Promise<FeatureToggle> {
		const toggle = await this.prisma.featureToggle.findUnique({ where: { key } });
		if (!toggle) throw new NotFoundException(`Feature toggle "${key}" not found`);
		return toggle;
	}

	async upsert(
		key: string,
		data: { enabled?: boolean; description?: string; config?: Prisma.InputJsonValue }
	): Promise<FeatureToggle> {
		return this.prisma.featureToggle.upsert({
			where: { key },
			update: {
				...(data.enabled !== undefined && { enabled: data.enabled }),
				...(data.config !== undefined && { config: data.config }),
				...(data.description !== undefined && { description: data.description }),
			},
			create: {
				key,
				enabled: data.enabled ?? false,
				description: data.description,
				config: data.config ?? Prisma.JsonNull,
			},
		});
	}

	async isEnabled(key: string): Promise<boolean> {
		const toggle = await this.prisma.featureToggle.findUnique({ where: { key } });
		return toggle?.enabled ?? false;
	}

	async seed(): Promise<void> {
		const defaults = [
			{
				key: FEATURE_TOGGLE_KEYS.API_SLOWDOWN,
				description: "Adds a random delay to API responses to simulate slow network/server",
				config: { minDelayMs: 200, maxDelayMs: 2000 },
			},
			{
				key: FEATURE_TOGGLE_KEYS.SAME_DAY_RESTRICTION,
				description:
					"When enabled, disables API-side same-day appointment cancel/reschedule restriction (UI-only enforcement)",
				config: {},
			},
			{
				key: FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_FRONTEND,
				description: "When enabled, disables client-side profile form validation (bug simulation)",
				config: {},
			},
			{
				key: FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_BACKEND,
				description: "When enabled, disables server-side profile update validation (bug simulation)",
				config: {},
			},
			{
				key: FEATURE_TOGGLE_KEYS.SHOW_FOOTER_LOGO,
				description: "When enabled, shows the Cerios logo in portal footers",
				config: {},
			},
		];

		for (const d of defaults) {
			await this.prisma.featureToggle.upsert({
				where: { key: d.key },
				update: {},
				create: {
					key: d.key,
					enabled: false,
					description: d.description,
					config: d.config,
				},
			});
		}
	}
}
