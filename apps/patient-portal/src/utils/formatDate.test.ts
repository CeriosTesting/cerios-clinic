import { describe, expect, it } from "vitest";

import { formatTime, nextUTCWeekday, prevUTCWeekday, toUTCDateString } from "./formatDate";

const utc = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe("formatTime", () => {
	it.each([
		["2026-07-01T07:00:00.000Z", "09:00"],
		["2026-07-01T12:30:00.000Z", "14:30"], // 24h clock, never "2:30 PM"
		["2026-07-01T22:05:00.000Z", "00:05"], // midnight is 00, not 24
	])("shows %s as %s (local time, 24h)", (iso, expected) => {
		expect(formatTime(new Date(iso))).toBe(expected);
	});
});

describe("weekday navigation (UTC)", () => {
	it("nextUTCWeekday skips the weekend", () => {
		expect(toUTCDateString(nextUTCWeekday(utc("2026-06-12")))).toBe("2026-06-15"); // Fri → Mon
		expect(toUTCDateString(nextUTCWeekday(utc("2026-06-10")))).toBe("2026-06-11"); // Wed → Thu
	});

	it("prevUTCWeekday skips the weekend but never goes before the minimum date", () => {
		expect(toUTCDateString(prevUTCWeekday(utc("2026-06-15"), utc("2026-06-01")))).toBe("2026-06-12"); // Mon → Fri
		expect(toUTCDateString(prevUTCWeekday(utc("2026-06-15"), utc("2026-06-15")))).toBe("2026-06-15");
	});
});
