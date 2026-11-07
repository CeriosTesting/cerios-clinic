import type { EventsService, MailService } from "@clinic/api-common";
import type { AppointmentStatus } from "@clinic/shared-types";
import {
	createEventsMock,
	createMailMock,
	createPrismaMock,
	tokenFor,
	type EventsMock,
	type MailMock,
	type PrismaMock,
} from "@clinic/test-utils";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { AppointmentsController } from "./appointments.controller";

const APPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const user = tokenFor("kc-assistant", ["assistant"]);
const SCHEDULED_AT = new Date("2026-06-11T09:00:00.000Z");

let prisma: PrismaMock;
let mail: MailMock;
let events: EventsMock;
let controller: AppointmentsController;

function withRelations(data: object): object {
	return {
		id: APPT_ID,
		patientId: "pat-1",
		doctorId: "doc-1",
		status: "SCHEDULED",
		scheduledAt: SCHEDULED_AT,
		patient: { user: { email: "pat@example.com", firstName: "Pat", lastName: "Jones" } },
		doctor: { user: { email: "doc@example.com", firstName: "Ann", lastName: "Smith" } },
		...data,
	};
}

function givenAppointment(status: AppointmentStatus): void {
	prisma.appointment.findUnique.mockResolvedValue(withRelations({ status }) as never);
}

function uniqueViolation(target: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: "test",
		meta: { target },
	});
}

beforeEach(() => {
	prisma = createPrismaMock();
	mail = createMailMock();
	events = createEventsMock();
	controller = new AppointmentsController(
		prisma as unknown as PrismaService,
		mail as unknown as MailService,
		events as unknown as EventsService
	);
	prisma.appointment.update.mockImplementation(((args: { data: object }) => withRelations(args.data)) as never);
	prisma.appointment.create.mockImplementation(((args: { data: object }) => withRelations(args.data)) as never);
	prisma.appointment.findFirst.mockResolvedValue(null);
	prisma.doctorUnavailability.findFirst.mockResolvedValue(null);
});

describe("PUT /appointments/:id – status changes", () => {
	it("rejects a transition that is not allowed, without saving", async () => {
		givenAppointment("COMPLETED");
		await expect(controller.update(APPT_ID, { status: "SCHEDULED" }, user, "UTC")).rejects.toThrow(BadRequestException);
		expect(prisma.appointment.update).not.toHaveBeenCalled();
	});

	it.each<[AppointmentStatus, AppointmentStatus, "confirmation" | "cancellation" | "none"]>([
		["SCHEDULED", "CONFIRMED", "confirmation"],
		["SCHEDULED", "CANCELLED", "cancellation"],
		["CONFIRMED", "CANCELLED", "cancellation"],
		["CONFIRMED", "COMPLETED", "none"],
	])("%s → %s sends %s email in the client timezone", async (from, to, email) => {
		givenAppointment(from);

		await controller.update(APPT_ID, { status: to }, user, "Asia/Tokyo");

		expect(prisma.appointmentStatusChange.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ previousStatus: from, newStatus: to }),
		});
		expect(mail.sendAppointmentConfirmation).toHaveBeenCalledTimes(email === "confirmation" ? 1 : 0);
		expect(mail.sendAppointmentCancellation).toHaveBeenCalledTimes(email === "cancellation" ? 1 : 0);
		const emailTimeZones = [
			...mail.sendAppointmentConfirmation.mock.calls,
			...mail.sendAppointmentCancellation.mock.calls,
		].map(call => call.at(-1));
		expect(emailTimeZones).toEqual(email === "none" ? [] : ["Asia/Tokyo"]);
		expect(events.emitAppointmentEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: to === "CANCELLED" ? "appointment.cancelled" : "appointment.updated" })
		);
	});

	it("does not record history or send email when only notes change", async () => {
		givenAppointment("SCHEDULED");
		await controller.update(APPT_ID, { notes: "Bring referral letter" }, user, "UTC");
		expect(prisma.appointmentStatusChange.create).not.toHaveBeenCalled();
		expect(mail.sendAppointmentConfirmation).not.toHaveBeenCalled();
	});
});

describe("PUT /appointments/:id – rescheduling", () => {
	it.each([
		[
			{ doctorId: "doc-1", patientId: "pat-1" },
			"This patient already has an appointment with this doctor at this time",
		],
		[{ doctorId: "doc-1", patientId: "pat-2" }, "This doctor already has an appointment at this time"],
		[{ doctorId: "doc-2", patientId: "pat-1" }, "This patient already has an appointment at this time"],
	])("explains a conflict with %o", async (conflict, message) => {
		givenAppointment("SCHEDULED");
		prisma.appointment.findFirst.mockResolvedValue({ id: "other", ...conflict } as never);
		await expect(controller.update(APPT_ID, { scheduledAt: "2026-06-12T10:00:00.000Z" }, user, "UTC")).rejects.toThrow(
			message
		);
	});

	it("rejects a time inside the doctor's time off", async () => {
		givenAppointment("SCHEDULED");
		prisma.doctorUnavailability.findFirst.mockResolvedValue({ id: "block" } as never);
		await expect(controller.update(APPT_ID, { scheduledAt: "2026-06-12T10:00:00.000Z" }, user, "UTC")).rejects.toThrow(
			"The doctor is unavailable at the selected time"
		);
	});

	it("skips the conflict check when the time does not change", async () => {
		givenAppointment("SCHEDULED");
		await controller.update(APPT_ID, { scheduledAt: SCHEDULED_AT.toISOString() }, user, "UTC");
		expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
	});

	it("turns a database unique-constraint race into a readable 409", async () => {
		givenAppointment("SCHEDULED");
		prisma.appointment.update.mockRejectedValue(uniqueViolation("Appointment_doctorId_scheduledAt_key"));
		const attempt = controller.update(APPT_ID, { scheduledAt: "2026-06-12T10:00:00.000Z" }, user, "UTC");
		await expect(attempt).rejects.toThrow(ConflictException);
		await expect(attempt).rejects.toThrow("This doctor already has an appointment at this time");
	});
});

describe("POST /appointments", () => {
	const dto = { patientId: "pat-1", doctorId: "doc-1", scheduledAt: "2026-06-11T09:00:45.123Z" };

	beforeEach(() => {
		prisma.patient.findFirst.mockResolvedValue({ id: "pat-1" } as never);
		prisma.doctor.findFirst.mockResolvedValue({ id: "doc-1" } as never);
		prisma.user.findUnique.mockResolvedValue({ assistant: { id: "asst-1" } } as never);
	});

	it("drops seconds, stores SCHEDULED, and sends a confirmation in the client timezone", async () => {
		await controller.create(dto, user, "Europe/Amsterdam");

		expect(prisma.appointment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					scheduledAt: new Date("2026-06-11T09:00:00.000Z"),
					status: "SCHEDULED",
					assistantId: "asst-1",
				}),
			})
		);
		expect(mail.sendAppointmentConfirmation).toHaveBeenCalledWith(
			"pat@example.com",
			"Pat Jones",
			"Ann Smith",
			expect.any(Date),
			"Europe/Amsterdam"
		);
	});

	it("maps a unique-constraint race on the patient to a readable 409", async () => {
		prisma.appointment.create.mockRejectedValue(uniqueViolation("Appointment_patientId_scheduledAt_key"));
		await expect(controller.create(dto, user, "UTC")).rejects.toThrow(
			"This patient already has an appointment at this time"
		);
	});
});

describe("GET /appointments", () => {
	beforeEach(() => {
		prisma.appointment.findMany.mockResolvedValue([]);
		prisma.appointment.count.mockResolvedValue(0);
	});

	it.each([
		[undefined, undefined, 50, 0],
		["1000", "-5", 200, 0],
		["abc", "20", 50, 20],
	])("limit=%s offset=%s → take %i, skip %i", async (limit, offset, take, skip) => {
		await controller.findAll(
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			limit,
			offset
		);
		expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take, skip }));
	});

	it("matches every search word against patient or doctor names", async () => {
		await controller.findAll(undefined, undefined, undefined, undefined, "  ann   jones ");
		const where = (prisma.appointment.findMany.mock.calls[0][0] as { where: { AND: unknown[] } }).where;
		expect(where.AND).toHaveLength(2);
	});

	it("rejects an invalid date filter", async () => {
		await expect(controller.findAll(undefined, undefined, "not-a-date")).rejects.toThrow("Invalid 'from' date");
	});
});
