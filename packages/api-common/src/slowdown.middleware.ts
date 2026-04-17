import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

import { PrismaService } from "./prisma.service";

const TOGGLE_KEY = "bug:api-slowdown";
const CACHE_TTL_MS = 5_000;

interface SlowdownConfig {
	minDelayMs: number;
	maxDelayMs: number;
}

interface CachedToggle {
	enabled: boolean;
	config: SlowdownConfig;
	fetchedAt: number;
}

@Injectable()
export class SlowdownMiddleware implements NestMiddleware {
	private readonly logger = new Logger(SlowdownMiddleware.name);
	private cache: CachedToggle | null = null;

	constructor(private readonly prisma: PrismaService) {}

	async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
		try {
			const toggle = await this.getToggle();
			if (toggle.enabled) {
				const delay = this.randomDelay(toggle.config.minDelayMs, toggle.config.maxDelayMs);
				this.logger.debug(`[BUG:slowdown] Delaying ${req.method} ${req.url} by ${delay}ms`);
				await this.sleep(delay);
			}
		} catch {
			// If the toggle table doesn't exist yet or anything fails, just skip
		}
		next();
	}

	private async getToggle(): Promise<CachedToggle> {
		if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
			return this.cache;
		}

		const row = await this.prisma.featureToggle.findUnique({ where: { key: TOGGLE_KEY } });

		const config = (row?.config as unknown as SlowdownConfig) ?? { minDelayMs: 200, maxDelayMs: 2000 };
		this.cache = {
			enabled: row?.enabled ?? false,
			config: {
				minDelayMs: config.minDelayMs ?? 200,
				maxDelayMs: config.maxDelayMs ?? 2000,
			},
			fetchedAt: Date.now(),
		};
		return this.cache;
	}

	private randomDelay(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
