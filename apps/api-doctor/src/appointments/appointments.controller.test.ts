import type { EventsService, MailService } from "@clinic/api-common";
import {
	createEventsMock,
	createMailMock,
	createPrismaMock,
	tokenFor,
	type MailMock,
	type PrismaMock,
} from "@clinic/test-utils";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { AppointmentsController } from "./appointments.controller";

const APPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const user = tokenFor("kc-doctor", ["doctor"]);

let prisma: PrismaMock;
let mail: MailMock;
let controller: AppointmentsController;

function givenAppointment(status: string, doctorId = "doc-1"): void {
	const appointment = {
		id: APPT_ID,
		patientId: "pat-1",
		doctorId,
		status,
		scheduledAt: new Date("2026-06-11T09:00:00.000Z"),
		patient: { user: { email: "pat@example.com", firstName: "Pat", lastName: "Jones" } },
		doctor: { user: { email: "doc@example.com", firstName: "Ann", lastName: "Smith" } },
	};
	prisma.appointment.findUnique.mockResolvedValue(appointment as never);
	prisma.appointment.update.mockImplementation(((args: { data: object }) => ({
		...appointment,
		...args.data,
	})) as never);
}

beforeEach(() => {
	prisma = createPrismaMock();
	mail = createMailMock();
	controller = new AppointmentsController(
		prisma as unknown as PrismaService,
		mail as unknown as MailService,
		createEventsMock() as unknown as EventsService
	);
	prisma.user.findUnique.mockResolvedValue({ id: "user-1", doctor: { id: "doc-1" } } as never);
});

describe("PUT /appointments/:id (doctor)", () => {
	it("confirms an appointment and emails the patient in the client timezone", async () => {
		givenAppointment("SCHEDULED");
		await controller.update(APPT_ID, { status: "CONFIRMED" }, user, "Europe/London");
		expect(mail.sendAppointmentConfirmation).toHaveBeenCalledWith(
			"pat@example.com",
			"Pat Jones",
			"Ann Smith",
			expect.any(Date),
			"Europe/London"
		);
	});

	it("rejects a transition that is not allowed", async () => {
		givenAppointment("CANCELLED");
		await expect(controller.update(APPT_ID, { status: "CONFIRMED" }, user, "UTC")).rejects.toThrow(BadRequestException);
		expect(prisma.appointment.update).not.toHaveBeenCalled();
	});

	it("cannot change another doctor's appointment", async () => {
		givenAppointment("SCHEDULED", "doc-other");
		await expect(controller.update(APPT_ID, { notes: "x" }, user, "UTC")).rejects.toThrow(ForbiddenException);
	});
});
