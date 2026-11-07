import type { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PrismaExceptionFilter } from "./prisma-exception.filter";

function respond(code: string): { status: number; body: unknown } {
	const json = vi.fn<(body: unknown) => void>();
	const status = vi.fn<(code: number) => { json: typeof json }>(() => ({ json }));
	const host = {
		switchToHttp: () => ({ getResponse: (): { status: typeof status } => ({ status }) }),
	} as unknown as ArgumentsHost;
	const error = new Prisma.PrismaClientKnownRequestError("db error with internal details", {
		code,
		clientVersion: "test",
	});

	new PrismaExceptionFilter().catch(error, host);

	return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe("PrismaExceptionFilter", () => {
	it.each([
		["P2002", 409, "A record with this value already exists"],
		["P2025", 404, "Record not found"],
		["P2003", 400, "Referenced record does not exist"],
		["P2014", 400, "Invalid relation"],
		["P1001", 500, "An unexpected database error occurred"],
	])("maps %s to HTTP %i", (code, expectedStatus, message) => {
		const { status, body } = respond(code);
		expect(status).toBe(expectedStatus);
		expect(body).toEqual({ statusCode: expectedStatus, message });
	});

	it("never leaks the original database message", () => {
		expect(JSON.stringify(respond("P1001").body)).not.toContain("internal details");
	});
});
