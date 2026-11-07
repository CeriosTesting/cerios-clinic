import { createPrismaMock, freezeTime, tokenFor, type PrismaMock } from "@clinic/test-utils";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { AvailabilityController } from "./availability.controller";

const user = tokenFor("kc-doctor", ["doctor"]);

let prisma: PrismaMock;
let controller: AvailabilityController;

beforeEach(() => {
	freezeTime("2026-06-10T10:00:00.000Z");
	prisma = createPrismaMock();
	controller = new AvailabilityController(prisma as unknown as PrismaService);
	prisma.user.findUnique.mockResolvedValue({ id: "user-1", doctor: { id: "doc-1" } } as never);
	prisma.doctorUnavailability.findFirst.mockResolvedValue(null);
	prisma.doctorUnavailability.create.mockImplementation(((args: { data: object }) => ({
		id: "block-1",
		...args.data,
	})) as never);
});

describe("POST /availability (block time off)", () => {
	it("creates a block in the future", async () => {
		const result = await controller.create(
			{ startDate: "2026-06-11T09:00:00.000Z", endDate: "2026-06-11T12:00:00.000Z", reason: "Conference" },
			user
		);
		expect(result.data).toMatchObject({ doctorId: "doc-1", reason: "Conference" });
	});

	it.each([
		["an invalid date", "tomorrow", "2026-06-11T12:00:00.000Z", "Invalid date format"],
		["end equal to start", "2026-06-11T09:00:00.000Z", "2026-06-11T09:00:00.000Z", "End date must be after start date"],
		["end before start", "2026-06-11T12:00:00.000Z", "2026-06-11T09:00:00.000Z", "End date must be after start date"],
		["a start in the past", "2026-06-10T09:00:00.000Z", "2026-06-10T12:00:00.000Z", "Cannot block time in the past"],
	])("rejects %s", async (_label, startDate, endDate, message) => {
		await expect(controller.create({ startDate, endDate }, user)).rejects.toThrow(message);
		expect(prisma.doctorUnavailability.create).not.toHaveBeenCalled();
	});

	it("rejects a block that overlaps an existing one", async () => {
		prisma.doctorUnavailability.findFirst.mockResolvedValue({ id: "existing" } as never);
		await expect(
			controller.create({ startDate: "2026-06-11T09:00:00.000Z", endDate: "2026-06-11T12:00:00.000Z" }, user)
		).rejects.toThrow(BadRequestException);
	});

	it("checks overlap with the standard interval test (start < otherEnd and end > otherStart)", async () => {
		const startDate = "2026-06-11T09:00:00.000Z";
		const endDate = "2026-06-11T12:00:00.000Z";
		await controller.create({ startDate, endDate }, user);
		expect(prisma.doctorUnavailability.findFirst).toHaveBeenCalledWith({
			where: { doctorId: "doc-1", startDate: { lt: new Date(endDate) }, endDate: { gt: new Date(startDate) } },
		});
	});
});
