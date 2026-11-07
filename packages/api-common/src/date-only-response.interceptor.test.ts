import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import { DateOnlyResponseInterceptor } from "./date-only-response.interceptor";

function intercept(value: unknown): Promise<unknown> {
	const next: CallHandler = { handle: () => of(value) };
	return firstValueFrom(new DateOnlyResponseInterceptor().intercept({} as ExecutionContext, next));
}

describe("DateOnlyResponseInterceptor", () => {
	it.each([
		["a Date at UTC midnight", new Date("1990-05-17T00:00:00.000Z"), "1990-05-17"],
		["an ISO timestamp", "1990-05-17T00:00:00.000Z", "1990-05-17"],
		["a date-only string", "1990-05-17", "1990-05-17"],
		["an unparseable string (left alone)", "unknown", "unknown"],
	])("formats dateOfBirth from %s", async (_label, input, expected) => {
		expect(await intercept({ dateOfBirth: input })).toEqual({ dateOfBirth: expected });
	});

	it("rewrites nested objects and arrays, and leaves other date fields alone", async () => {
		const scheduledAt = new Date("2026-06-11T09:00:00.000Z");
		const result = await intercept({
			data: [{ scheduledAt, patient: { dateOfBirth: new Date("1990-05-17T00:00:00.000Z") } }],
		});
		expect(result).toEqual({ data: [{ scheduledAt, patient: { dateOfBirth: "1990-05-17" } }] });
	});

	it("does not mutate the original response object", async () => {
		const original = { patient: { dateOfBirth: new Date("1990-05-17T00:00:00.000Z") } };
		const result = await intercept(original);
		expect(original.patient.dateOfBirth).toBeInstanceOf(Date);
		expect(result).not.toBe(original);
	});

	it("returns the same reference when nothing changes", async () => {
		const original = { data: [{ name: "x" }] };
		expect(await intercept(original)).toBe(original);
	});

	it("survives circular references", async () => {
		const node: Record<string, unknown> = { dateOfBirth: "1990-05-17T10:00:00.000Z" };
		node.self = node;
		const result = (await intercept(node)) as Record<string, unknown>;
		expect(result.dateOfBirth).toBe("1990-05-17");
	});
});
