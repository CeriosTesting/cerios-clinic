import { describe, expect, it } from "vitest";

import { getStatusTransitionError, type AppointmentStatus } from "./appointment-status";
import {
	buildAvailableSlots,
	buildDaySlots,
	getSlotTimeError,
	isSameUTCDay,
	isUTCWeekday,
	parseSlotRange,
	tomorrowUTC,
} from "./scheduling";

// Wednesday 10 June 2026, 10:00 UTC. Thu 11 = tomorrow, Sat 13 / Sun 14 = weekend, Mon 15.
const NOW = new Date("2026-06-10T10:00:00.000Z");

const ERR = {
	invalid: "Invalid scheduledAt datetime.",
	notTomorrow: "Appointments can only be rescheduled to tomorrow or later.",
	weekend: "Appointments can only be scheduled on weekdays (Mon–Fri).",
	hours: "Appointments must be within working hours (9:00–17:00 UTC).",
	boundary: "Appointment time must align to a 30-minute slot boundary.",
};

describe("getSlotTimeError", () => {
	it.each([
		["first slot of tomorrow", "2026-06-11T09:00:00.000Z"],
		["last slot of the day", "2026-06-11T16:30:00.000Z"],
		["next Monday", "2026-06-15T13:00:00.000Z"],
		["same moment written with an offset", "2026-06-11T11:00:00+02:00"],
	])("accepts %s (%s)", (_label, iso) => {
		expect(getSlotTimeError(iso, NOW)).toBeNull();
	});

	it.each([
		["unparseable input", "not-a-date", ERR.invalid],
		["today", "2026-06-10T14:00:00.000Z", ERR.notTomorrow],
		["the past", "2026-06-09T10:00:00.000Z", ERR.notTomorrow],
		["Saturday", "2026-06-13T10:00:00.000Z", ERR.weekend],
		["Sunday", "2026-06-14T10:00:00.000Z", ERR.weekend],
		["08:59 (before opening)", "2026-06-11T08:59:00.000Z", ERR.hours],
		["17:00 (closing time is exclusive)", "2026-06-11T17:00:00.000Z", ERR.hours],
		["09:00 local Amsterdam time (= 07:00 UTC)", "2026-06-11T09:00:00+02:00", ERR.hours],
		["a quarter past", "2026-06-11T09:15:00.000Z", ERR.boundary],
		["seconds set", "2026-06-11T09:00:30.000Z", ERR.boundary],
		["milliseconds set", "2026-06-11T09:00:00.001Z", ERR.boundary],
	])("rejects %s (%s)", (_label, iso, expected) => {
		expect(getSlotTimeError(iso, NOW)).toBe(expected);
	});

	it("uses the UTC day for 'tomorrow', not the local day", () => {
		// 23:30 UTC on the 10th is already the 11th in Amsterdam, but the 11th is still "tomorrow" in UTC.
		const lateEvening = new Date("2026-06-10T23:30:00.000Z");
		expect(getSlotTimeError("2026-06-11T09:00:00.000Z", lateEvening)).toBeNull();

		const afterUtcMidnight = new Date("2026-06-11T00:00:00.000Z");
		expect(getSlotTimeError("2026-06-11T09:00:00.000Z", afterUtcMidnight)).toBe(ERR.notTomorrow);
	});
});

describe("parseSlotRange", () => {
	it("returns UTC midnights for a valid range", () => {
		const result = parseSlotRange("2026-06-11", "2026-06-17", NOW);
		expect(result.error).toBeUndefined();
		expect(result.value?.from.toISOString()).toBe("2026-06-11T00:00:00.000Z");
		expect(result.value?.to.toISOString()).toBe("2026-06-17T00:00:00.000Z");
	});

	it.each([
		["missing 'from'", undefined, "2026-06-12", "Query params 'from' and 'to' are required."],
		["missing 'to'", "2026-06-11", "", "Query params 'from' and 'to' are required."],
		["wrong format", "2026-6-11", "2026-06-12", 'Invalid date format "2026-6-11". Expected YYYY-MM-DD.'],
		["impossible date", "2026-06-11", "2026-13-01", 'Invalid date "2026-13-01".'],
		["'from' is today", "2026-06-10", "2026-06-12", "'from' must be tomorrow or later."],
		["'to' before 'from'", "2026-06-12", "2026-06-11", "'to' must not be before 'from'."],
		["8 days", "2026-06-11", "2026-06-18", "Date range must not exceed 7 days."],
	])("rejects %s", (_label, from, to, expected) => {
		expect(parseSlotRange(from, to, NOW).error).toBe(expected);
	});
});

describe("buildDaySlots", () => {
	it("has 16 half-hour slots from 09:00 up to and including 16:30", () => {
		const slots = buildDaySlots();
		expect(slots).toHaveLength(16);
		expect(slots[0]).toEqual({ hour: 9, minute: 0 });
		expect(slots.at(-1)).toEqual({ hour: 16, minute: 30 });
	});
});

describe("buildAvailableSlots", () => {
	const from = new Date("2026-06-11T00:00:00.000Z"); // Thu
	const to = new Date("2026-06-15T00:00:00.000Z"); // Mon

	it("lists every weekday in the range and skips the weekend", () => {
		const days = buildAvailableSlots({ from, to, booked: [], unavailable: [] });
		expect(days.map(d => d.date)).toEqual(["2026-06-11", "2026-06-12", "2026-06-15"]);
		expect(days.every(d => d.slots.length === 16)).toBe(true);
	});

	it("removes booked slots", () => {
		const days = buildAvailableSlots({
			from,
			to: from,
			booked: [new Date("2026-06-11T09:00:00.000Z"), new Date("2026-06-11T16:30:00.000Z")],
			unavailable: [],
		});
		expect(days[0].slots).toHaveLength(14);
		expect(days[0].slots).not.toContain("2026-06-11T09:00:00.000Z");
		expect(days[0].slots).not.toContain("2026-06-11T16:30:00.000Z");
	});

	it("removes slots inside an unavailability block (start inclusive, end exclusive)", () => {
		const days = buildAvailableSlots({
			from,
			to: from,
			booked: [],
			unavailable: [{ startDate: new Date("2026-06-11T12:00:00.000Z"), endDate: new Date("2026-06-11T14:00:00.000Z") }],
		});
		const slots = days[0].slots;
		expect(slots).not.toContain("2026-06-11T12:00:00.000Z");
		expect(slots).not.toContain("2026-06-11T13:30:00.000Z");
		expect(slots).toContain("2026-06-11T11:30:00.000Z");
		expect(slots).toContain("2026-06-11T14:00:00.000Z");
		expect(slots).toHaveLength(12);
	});

	it("handles a block spanning several days", () => {
		const days = buildAvailableSlots({
			from,
			to,
			booked: [],
			unavailable: [{ startDate: new Date("2026-06-11T15:00:00.000Z"), endDate: new Date("2026-06-15T10:00:00.000Z") }],
		});
		expect(days.map(d => d.slots.length)).toEqual([12, 0, 14]);
	});
});

describe("UTC day helpers", () => {
	it("tomorrowUTC is the next UTC midnight, also late in the evening", () => {
		expect(tomorrowUTC(new Date("2026-06-10T23:59:59.999Z")).toISOString()).toBe("2026-06-11T00:00:00.000Z");
	});

	it.each([
		["2026-06-12T23:30:00.000Z", true], // Friday in UTC, already Saturday in Amsterdam
		["2026-06-13T00:30:00.000Z", false], // Saturday in UTC
		["2026-06-14T23:30:00.000Z", false], // Sunday in UTC, already Monday in Amsterdam
	])("isUTCWeekday(%s) is %s", (iso, expected) => {
		expect(isUTCWeekday(new Date(iso))).toBe(expected);
	});

	it("isSameUTCDay compares UTC calendar days", () => {
		expect(isSameUTCDay(new Date("2026-06-10T00:00:00.000Z"), new Date("2026-06-10T23:59:59.999Z"))).toBe(true);
		expect(isSameUTCDay(new Date("2026-06-10T23:59:59.999Z"), new Date("2026-06-11T00:00:00.000Z"))).toBe(false);
	});
});

describe("getStatusTransitionError", () => {
	// Business rule, written out on purpose (not derived from ALLOWED_TRANSITIONS):
	// SCHEDULED → CONFIRMED | CANCELLED, CONFIRMED → COMPLETED | CANCELLED, COMPLETED and CANCELLED are final.
	const ALLOWED = new Set(["SCHEDULED>CONFIRMED", "SCHEDULED>CANCELLED", "CONFIRMED>COMPLETED", "CONFIRMED>CANCELLED"]);
	const STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"];
	const pairs = STATUSES.flatMap(from => STATUSES.filter(to => to !== from).map(to => [from, to] as const));
	const allowedPairs = pairs.filter(([from, to]) => ALLOWED.has(`${from}>${to}`));
	const forbiddenPairs = pairs.filter(([from, to]) => !ALLOWED.has(`${from}>${to}`));

	it.each(allowedPairs)("allows %s → %s", (from, to) => {
		expect(getStatusTransitionError(from, to)).toBeNull();
	});

	it.each(forbiddenPairs)("forbids %s → %s", (from, to) => {
		expect(getStatusTransitionError(from, to)).toMatch(`Cannot transition from ${from} to ${to}.`);
	});

	it("allows keeping the same status or sending no status", () => {
		expect(getStatusTransitionError("COMPLETED", "COMPLETED")).toBeNull();
		expect(getStatusTransitionError("CANCELLED", undefined)).toBeNull();
	});

	it("explains that final states allow nothing", () => {
		expect(getStatusTransitionError("COMPLETED", "SCHEDULED")).toBe(
			"Cannot transition from COMPLETED to SCHEDULED. Allowed: none (terminal state)"
		);
	});
});
