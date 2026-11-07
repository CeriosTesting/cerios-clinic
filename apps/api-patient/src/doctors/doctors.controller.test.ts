import { createPrismaMock, freezeTime, type PrismaMock } from "@clinic/test-utils";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { DoctorsController } from "./doctors.controller";

const DOCTOR_ID = "11111111-1111-1111-1111-111111111111";

let prisma: PrismaMock;
let controller: DoctorsController;

beforeEach(() => {
	freezeTime("2026-06-10T10:00:00.000Z"); // Wednesday
	prisma = createPrismaMock();
	controller = new DoctorsController(prisma as unknown as PrismaService);
	prisma.doctor.findFirst.mockResolvedValue({ id: DOCTOR_ID } as never);
	prisma.appointment.findMany.mockResolvedValue([]);
	prisma.doctorUnavailability.findMany.mockResolvedValue([]);
});

describe("GET /doctors/:id/slots", () => {
	it("returns free slots per weekday, without booked or blocked slots", async () => {
		prisma.appointment.findMany.mockResolvedValue([{ scheduledAt: new Date("2026-06-11T09:00:00.000Z") }] as never);
		prisma.doctorUnavailability.findMany.mockResolvedValue([
			{ startDate: new Date("2026-06-12T00:00:00.000Z"), endDate: new Date("2026-06-13T00:00:00.000Z") },
		] as never);

		const { data } = await controller.getSlots(DOCTOR_ID, "2026-06-11", "2026-06-15");

		expect(data.map(d => [d.date, d.slots.length])).toEqual([
			["2026-06-11", 15],
			["2026-06-12", 0],
			["2026-06-15", 16],
		]);
		expect(data[0].slots).not.toContain("2026-06-11T09:00:00.000Z");
	});

	it("ignores cancelled appointments and queries the whole last day", async () => {
		await controller.getSlots(DOCTOR_ID, "2026-06-11", "2026-06-12");

		expect(prisma.appointment.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					doctorId: DOCTOR_ID,
					status: { not: "CANCELLED" },
					scheduledAt: { gte: new Date("2026-06-11T00:00:00.000Z"), lt: new Date("2026-06-13T00:00:00.000Z") },
				},
			})
		);
	});

	it.each([
		["today", "2026-06-10", "2026-06-11"],
		["a range longer than 7 days", "2026-06-11", "2026-06-18"],
		["a malformed date", "11-06-2026", "2026-06-12"],
	])("rejects %s before touching the database", async (_label, from, to) => {
		await expect(controller.getSlots(DOCTOR_ID, from, to)).rejects.toThrow(BadRequestException);
		expect(prisma.doctor.findFirst).not.toHaveBeenCalled();
	});

	it("returns 404 for an unknown or deleted doctor", async () => {
		prisma.doctor.findFirst.mockResolvedValue(null);
		await expect(controller.getSlots(DOCTOR_ID, "2026-06-11", "2026-06-12")).rejects.toThrow(NotFoundException);
	});
});
