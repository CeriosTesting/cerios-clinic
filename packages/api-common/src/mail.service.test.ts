import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { createPrismaMock, mockToggles, type PrismaMock } from "@clinic/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MailService } from "./mail.service";
import type { PrismaService } from "./prisma.service";

const { sendMail } = vi.hoisted(() => ({
	sendMail: vi.fn<(options: { from: string; to: string; subject: string; html: string }) => Promise<unknown>>(),
}));
vi.mock("nodemailer", () => ({ createTransport: (): { sendMail: typeof sendMail } => ({ sendMail }) }));

const TZ_BUG = FEATURE_TOGGLE_KEYS.APPOINTMENT_TIMEZONE;

let prisma: PrismaMock;
let mail: MailService;

beforeEach(() => {
	sendMail.mockResolvedValue({});
	prisma = createPrismaMock();
	mail = new MailService(prisma as unknown as PrismaService);
});

/** Sends a confirmation for `iso` in `timeZone` and returns the email HTML. */
async function confirmationHtml(iso: string, timeZone: string): Promise<string> {
	await mail.sendAppointmentConfirmation("pat@example.com", "Pat Jones", "Ann Smith", new Date(iso), timeZone);
	expect(sendMail).toHaveBeenCalledTimes(1);
	return (sendMail.mock.calls[0][0] as { html: string }).html;
}

describe("appointment emails – toggle OFF (correct: client timezone)", () => {
	it.each([
		["Amsterdam summer (CEST, +2)", "2026-07-01T07:00:00.000Z", "Europe/Amsterdam", "09:00", "1 July 2026"],
		["Amsterdam winter (CET, +1)", "2026-01-15T08:00:00.000Z", "Europe/Amsterdam", "09:00", "15 January 2026"],
		["New York (EDT, -4)", "2026-07-01T13:00:00.000Z", "America/New_York", "09:00", "1 July 2026"],
		["date moves to the next day", "2026-07-01T23:30:00.000Z", "Europe/Amsterdam", "01:30", "2 July 2026"],
		["afternoon uses 24h format", "2026-07-01T12:30:00.000Z", "Europe/Amsterdam", "14:30", "1 July 2026"],
	])("%s", async (_label, iso, timeZone, time, date) => {
		const html = await confirmationHtml(iso, timeZone);
		expect(html).toContain(`>${time}<`);
		expect(html).toContain(date);
		expect(html).not.toMatch(/\b(AM|PM)\b/i);
	});

	it("falls back to Europe/Amsterdam for an invalid timezone", async () => {
		const html = await confirmationHtml("2026-07-01T07:00:00.000Z", "Not/AZone");
		expect(html).toContain(">09:00<");
	});

	it("treats a failing toggle lookup as OFF", async () => {
		prisma.featureToggle.findUnique.mockReturnValue(Promise.reject(new Error("db down")) as never);
		const html = await confirmationHtml("2026-07-01T07:00:00.000Z", "Europe/Amsterdam");
		expect(html).toContain(">09:00<");
	});

	it("uses the client timezone in cancellation and reminder emails too", async () => {
		const at = new Date("2026-07-01T07:00:00.000Z");
		await mail.sendAppointmentCancellation("pat@example.com", "Pat", "Ann", "Pat", at, "Europe/Amsterdam");
		await mail.sendAppointmentReminder("pat@example.com", "Pat", "Ann", at, "Europe/Amsterdam");
		for (const [options] of sendMail.mock.calls as Array<[{ html: string }]>) {
			expect(options.html).toContain(">09:00<");
		}
	});
});

describe(`appointment emails – ${TZ_BUG} ON (deliberate bug: UTC)`, () => {
	beforeEach(() => {
		mockToggles(prisma, { [TZ_BUG]: true });
	});

	it("shows the UTC time instead of the client time", async () => {
		const html = await confirmationHtml("2026-07-01T07:00:00.000Z", "Europe/Amsterdam");
		expect(html).toContain(">07:00<");
	});

	it("shows the UTC date, even when the local date is already the next day", async () => {
		const html = await confirmationHtml("2026-07-01T23:30:00.000Z", "Europe/Amsterdam");
		expect(html).toContain(">23:30<");
		expect(html).toContain("1 July 2026");
	});
});

describe("send", () => {
	it("sends from the configured address with the given subject", async () => {
		await mail.send({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ to: "a@example.com", subject: "Hi", from: "noreply@clinic.local" })
		);
	});

	it("does not throw when the SMTP server fails (email is best effort)", async () => {
		sendMail.mockRejectedValue(new Error("smtp down"));
		await expect(mail.send({ to: "a@example.com", subject: "Hi", html: "" })).resolves.toBeUndefined();
	});
});
