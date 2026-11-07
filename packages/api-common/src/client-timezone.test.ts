import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { ClientTimeZone, DEFAULT_TIMEZONE, resolveTimeZone } from "./client-timezone";

describe("resolveTimeZone", () => {
	it.each([
		["Europe/Amsterdam", "Europe/Amsterdam"],
		["America/New_York", "America/New_York"],
		["UTC", "UTC"],
		["Not/AZone", DEFAULT_TIMEZONE],
		["", DEFAULT_TIMEZONE],
		[undefined, DEFAULT_TIMEZONE],
		[null, DEFAULT_TIMEZONE],
	])("%s → %s", (input, expected) => {
		expect(resolveTimeZone(input)).toBe(expected);
	});

	it("defaults to the clinic timezone", () => {
		expect(DEFAULT_TIMEZONE).toBe("Europe/Amsterdam");
	});
});

describe("@ClientTimeZone()", () => {
	type Factory = (data: unknown, ctx: ExecutionContext) => string;

	/** Pulls the factory function out of a Nest param decorator. */
	function factoryOf(): Factory {
		class Target {
			handler(@ClientTimeZone() _tz: string): void {}
		}
		const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, "handler") as Record<string, { factory: Factory }>;
		return Object.values(args)[0].factory;
	}

	function contextWithHeaders(headers: Record<string, string | string[] | undefined>): ExecutionContext {
		return {
			switchToHttp: () => ({ getRequest: (): { headers: typeof headers } => ({ headers }) }),
		} as unknown as ExecutionContext;
	}

	// Node lower-cases incoming header names, so the decorator must read "x-client-timezone".
	it.each([
		["a valid header", { "x-client-timezone": "America/New_York" }, "America/New_York"],
		["a repeated header (first wins)", { "x-client-timezone": ["Asia/Tokyo", "UTC"] }, "Asia/Tokyo"],
		["an invalid header", { "x-client-timezone": "Mars/Base" }, DEFAULT_TIMEZONE],
		["no header (e.g. Swagger/Postman)", {}, DEFAULT_TIMEZONE],
	])("reads %s", (_label, headers, expected) => {
		expect(factoryOf()(undefined, contextWithHeaders(headers))).toBe(expected);
	});
});
