import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { createPrismaMock, type PrismaMock } from "@clinic/test-utils";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { FeatureTogglesService } from "./feature-toggles.service";

let prisma: PrismaMock;
let service: FeatureTogglesService;

beforeEach(() => {
	prisma = createPrismaMock();
	service = new FeatureTogglesService(prisma as unknown as PrismaService);
});

describe("seed", () => {
	it("creates every known toggle, switched off", async () => {
		await service.seed();

		const created = prisma.featureToggle.upsert.mock.calls.map(([args]) => args.create);
		expect(created.map(c => c.key).sort()).toEqual(Object.values(FEATURE_TOGGLE_KEYS).sort());
		expect(created.every(c => c.enabled === false && Boolean(c.description))).toBe(true);
	});

	it("never overwrites a toggle an admin already changed", async () => {
		await service.seed();
		for (const [args] of prisma.featureToggle.upsert.mock.calls) {
			expect(args.update).toEqual({});
		}
	});
});

describe("lookups", () => {
	it("findByKey returns 404 for an unknown toggle", async () => {
		await expect(service.findByKey("bug:does-not-exist")).rejects.toThrow(NotFoundException);
	});

	it("isEnabled is false for a missing toggle", async () => {
		await expect(service.isEnabled("bug:does-not-exist")).resolves.toBe(false);
	});
});

describe("upsert", () => {
	it("only updates the fields that were sent", async () => {
		await service.upsert(FEATURE_TOGGLE_KEYS.API_SLOWDOWN, { enabled: true });
		expect(prisma.featureToggle.upsert.mock.calls[0][0].update).toEqual({ enabled: true });
	});
});
