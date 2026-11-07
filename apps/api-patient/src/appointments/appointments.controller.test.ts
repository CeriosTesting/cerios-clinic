import type { EventsService, MailService } from "@clinic/api-common";
import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import {
	createEventsMock,
	createMailMock,
	createPrismaMock,
	freezeTime,
	mockToggles,
	tokenFor,
	type EventsMock,
	type MailMock,
	type PrismaMock,
} from "@clinic/test-utils";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { AppointmentsController } from "./appointments.controller";

const SAME_DAY_BUG = FEATURE_TOGGLE_KEYS.SAME_DAY_RESTRICTION;
const APPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const user = tokenFor("kc-patient", ["patient"]);

let prisma: PrismaMock;
let mail: MailMock;
let events: EventsMock;
let controller: AppointmentsController;

/** Stubs the logged-in patient and one of their appointments. */
function givenAppointment(overrides: { scheduledAt: string; status?: string; patientId?: string }): void {
	const appointment = {
		id: APPT_ID,
		patientId: overrides.patientId ?? "pat-1",
		doctorId: "doc-1",
		status: overrides.status ?? "SCHEDULED",
		scheduledAt: new Date(overrides.scheduledAt),
	};
	prisma.user.findUnique.mockResolvedValue({
		id: "user-1",
		email: "pat@example.com",
		firstName: "Pat",
		lastName: "Jones",
		patient: { id: "pat-1" },
	} as never);
	prisma.appointment.findUnique.mockResolvedValue(appointment as never);
	prisma.appointment.update.mockImplementation(((args: { data: object }) => ({
		...appointment,
		...args.data,
		doctor: { user: { email: "doc@example.com", firstName: "Ann", lastName: "Smith" } },
	})) as never);
	prisma.appointment.findFirst.mockResolvedValue(null);
	prisma.doctorUnavailability.findFirst.mockResolvedValue(null);
}

beforeEach(() => {
	freezeTime("2026-06-10T07:00:00.000Z"); // Wednesday morning
	prisma = createPrismaMock();
	mail = createMailMock();
	events = createEventsMock();
	controller = new AppointmentsController(
		prisma as unknown as PrismaService,
		mail as unknown as MailService,
		events as unknown as EventsService
	);
});

describe("PATCH /appointments/:id/cancel", () => {
	it("cancels a future appointment, records history, notifies patient + doctor in the client timezone", async () => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z" });

		const result = await controller.cancel(APPT_ID, user, "America/New_York");

		expect(result.data.status).toBe("CANCELLED");
		expect(prisma.appointmentStatusChange.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ previousStatus: "SCHEDULED", newStatus: "CANCELLED" }),
		});
		expect(mail.sendAppointmentCancellation).toHaveBeenCalledTimes(2);
		const recipients = mail.sendAppointmentCancellation.mock.calls.map(c => c[0]);
		expect(recipients).toEqual(["pat@example.com", "doc@example.com"]);
		for (const call of mail.sendAppointmentCancellation.mock.calls) {
			expect(call[5]).toBe("America/New_York");
		}
		expect(events.emitAppointmentEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: "appointment.cancelled", status: "CANCELLED" })
		);
	});

	it.each(["COMPLETED", "CANCELLED"])("refuses to cancel a %s appointment", async status => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z", status });
		await expect(controller.cancel(APPT_ID, user, "UTC")).rejects.toThrow(BadRequestException);
	});

	it("refuses to cancel another patient's appointment", async () => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z", patientId: "pat-other" });
		await expect(controller.cancel(APPT_ID, user, "UTC")).rejects.toThrow(ForbiddenException);
		expect(prisma.appointment.update).not.toHaveBeenCalled();
	});

	describe(`${SAME_DAY_BUG} OFF (correct: same-day blocked)`, () => {
		it("blocks cancelling an appointment later today", async () => {
			givenAppointment({ scheduledAt: "2026-06-10T14:00:00.000Z" });
			await expect(controller.cancel(APPT_ID, user, "UTC")).rejects.toThrow(
				"Same-day cancellation is not possible online. Please call the clinic directly."
			);
			expect(prisma.appointment.update).not.toHaveBeenCalled();
		});

		it("compares UTC days: at 23:30 UTC, tomorrow's appointment is not same-day (even if local time is past midnight)", async () => {
			freezeTime("2026-06-10T23:30:00.000Z");
			givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z" });
			await expect(controller.cancel(APPT_ID, user, "Europe/Amsterdam")).resolves.toBeDefined();
		});
	});

	describe(`${SAME_DAY_BUG} ON (deliberate bug: restriction is UI-only)`, () => {
		it("allows cancelling an appointment later today", async () => {
			mockToggles(prisma, { [SAME_DAY_BUG]: true });
			givenAppointment({ scheduledAt: "2026-06-10T14:00:00.000Z" });
			await expect(controller.cancel(APPT_ID, user, "UTC")).resolves.toMatchObject({
				message: "Appointment cancelled",
			});
		});
	});
});

describe("PATCH /appointments/:id/reschedule", () => {
	const NEW_SLOT = "2026-06-12T10:30:00.000Z";

	it("moves the appointment and records old and new time", async () => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z" });

		await controller.reschedule(APPT_ID, { scheduledAt: NEW_SLOT }, user);

		expect(prisma.appointment.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { scheduledAt: new Date(NEW_SLOT) } })
		);
		expect(prisma.appointmentStatusChange.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				previousScheduledAt: new Date("2026-06-11T09:00:00.000Z"),
				newScheduledAt: new Date(NEW_SLOT),
			}),
		});
	});

	it("validates the new slot before touching the database", async () => {
		await expect(controller.reschedule(APPT_ID, { scheduledAt: "2026-06-13T10:00:00.000Z" }, user)).rejects.toThrow(
			"Appointments can only be scheduled on weekdays (Mon–Fri)."
		);
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it("rejects a slot another patient just booked", async () => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z" });
		prisma.appointment.findFirst.mockResolvedValue({ id: "other" } as never);
		await expect(controller.reschedule(APPT_ID, { scheduledAt: NEW_SLOT }, user)).rejects.toThrow(ConflictException);
		expect(prisma.appointment.update).not.toHaveBeenCalled();
	});

	it("rejects a slot inside the doctor's time off", async () => {
		givenAppointment({ scheduledAt: "2026-06-11T09:00:00.000Z" });
		prisma.doctorUnavailability.findFirst.mockResolvedValue({ id: "block" } as never);
		await expect(controller.reschedule(APPT_ID, { scheduledAt: NEW_SLOT }, user)).rejects.toThrow(
			"The doctor is unavailable at the selected time. Please choose a different slot."
		);
	});

	describe(`${SAME_DAY_BUG} OFF (correct: same-day blocked)`, () => {
		it("blocks rescheduling an appointment that is today", async () => {
			givenAppointment({ scheduledAt: "2026-06-10T14:00:00.000Z" });
			await expect(controller.reschedule(APPT_ID, { scheduledAt: NEW_SLOT }, user)).rejects.toThrow(
				"Same-day rescheduling is not possible online. Please call the clinic directly."
			);
		});
	});

	describe(`${SAME_DAY_BUG} ON (deliberate bug: restriction is UI-only)`, () => {
		it("allows rescheduling an appointment that is today", async () => {
			mockToggles(prisma, { [SAME_DAY_BUG]: true });
			givenAppointment({ scheduledAt: "2026-06-10T14:00:00.000Z" });
			await expect(controller.reschedule(APPT_ID, { scheduledAt: NEW_SLOT }, user)).resolves.toMatchObject({
				message: "Appointment rescheduled",
			});
		});
	});
});
