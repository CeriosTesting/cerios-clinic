// Runs with TZ=Europe/Amsterdam (see vitest.config.ts): CET (+1) in winter, CEST (+2) in summer.
import { describe, expect, it } from "vitest";

import { formatDateOnly } from "./date-only";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "./date-time";

describe("toDateTimeLocalValue (UTC → <input type=datetime-local>)", () => {
	it.each([
		["summer", "2026-07-01T07:00:00.000Z", "2026-07-01T09:00"],
		["winter", "2026-01-15T08:00:00.000Z", "2026-01-15T09:00"],
		["late UTC evening is the next local day", "2026-07-01T23:30:00.000Z", "2026-07-02T01:30"],
	])("%s: %s → %s", (_label, iso, expected) => {
		expect(toDateTimeLocalValue(iso)).toBe(expected);
		expect(toDateTimeLocalValue(new Date(iso))).toBe(expected);
	});

	it("returns an empty string for invalid input", () => {
		expect(toDateTimeLocalValue("garbage")).toBe("");
	});
});

describe("fromDateTimeLocalValue (<input> → UTC ISO)", () => {
	it.each([
		["summer", "2026-07-01T09:00", "2026-07-01T07:00:00.000Z"],
		["winter", "2026-01-15T09:00", "2026-01-15T08:00:00.000Z"],
	])("%s: %s → %s", (_label, local, expected) => {
		expect(fromDateTimeLocalValue(local)).toBe(expected);
	});

	it.each(["2026-03-28T10:00:00.000Z", "2026-03-30T10:00:00.000Z", "2026-10-26T10:00:00.000Z"])(
		"round-trips %s across a DST change without drift",
		iso => {
			expect(fromDateTimeLocalValue(toDateTimeLocalValue(iso))).toBe(iso);
		}
	);
});

describe("formatDateOnly", () => {
	it.each([
		["a date-only string", "1990-05-17", "17/05/1990"],
		["a timestamp late in the UTC day (no shift to the 18th)", "1990-05-17T23:30:00.000Z", "17/05/1990"],
		["empty input", "", ""],
		["null", null, ""],
		["garbage", "17-05-1990", ""],
	])("formats %s", (_label, value, expected) => {
		expect(formatDateOnly(value, "en-GB")).toBe(expected);
	});
});
