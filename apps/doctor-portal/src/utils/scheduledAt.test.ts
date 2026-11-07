// Runs with TZ=Europe/Amsterdam (see vitest.config.ts), so local time is UTC+2 in July.
import { describe, expect, it } from "vitest";

import { scheduledAtInputValue, scheduledAtPayload } from "./scheduledAt";

const STORED = "2026-07-01T07:00:00.000Z"; // 09:00 in Amsterdam

describe("bug:appointment-timezone OFF (correct: local time)", () => {
	it("shows the stored time in local time", () => {
		expect(scheduledAtInputValue(STORED, false)).toBe("2026-07-01T09:00");
	});

	it("sends the edited local time as UTC", () => {
		expect(scheduledAtPayload("2026-07-01T09:00", false)).toBe(STORED);
	});

	it("saving without edits keeps the same moment", () => {
		expect(scheduledAtPayload(scheduledAtInputValue(STORED, false), false)).toBe(STORED);
	});

	it("sends nothing when the field is empty", () => {
		expect(scheduledAtPayload("", false)).toBeUndefined();
	});
});

describe("bug:appointment-timezone ON (deliberate bug: UTC shown as local)", () => {
	it("shows the UTC time as if it were local", () => {
		expect(scheduledAtInputValue(STORED, true)).toBe("2026-07-01T07:00");
	});

	it("sends the raw value without a timezone", () => {
		expect(scheduledAtPayload("2026-07-01T07:00", true)).toBe("2026-07-01T07:00");
	});
});
