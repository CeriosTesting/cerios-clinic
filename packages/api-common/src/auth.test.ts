import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { JwtAuthGuard, RolesGuard } from "./auth";

function context(user?: { realm_access?: { roles: string[] } }): ExecutionContext {
	return {
		getHandler: () => (): void => {},
		getClass: () => class {},
		switchToHttp: () => ({ getRequest: (): { user: typeof user } => ({ user }) }),
	} as unknown as ExecutionContext;
}

function reflectorReturning(value: unknown): Reflector {
	return { get: () => value, getAllAndOverride: () => value } as unknown as Reflector;
}

describe("RolesGuard", () => {
	it("allows any authenticated user when the route requires no role", () => {
		expect(new RolesGuard(reflectorReturning(undefined)).canActivate(context())).toBe(true);
		expect(new RolesGuard(reflectorReturning([])).canActivate(context())).toBe(true);
	});

	it("allows a user with one of the required roles", () => {
		const guard = new RolesGuard(reflectorReturning(["doctor", "assistant"]));
		expect(guard.canActivate(context({ realm_access: { roles: ["offline_access", "assistant"] } }))).toBe(true);
	});

	it.each([
		["a different role", { realm_access: { roles: ["patient"] } }],
		["no roles claim", {}],
		["no user on the request", undefined],
	])("forbids a user with %s", (_label, user) => {
		const guard = new RolesGuard(reflectorReturning(["doctor"]));
		expect(() => guard.canActivate(context(user))).toThrow(ForbiddenException);
	});
});

describe("JwtAuthGuard", () => {
	it("lets @Public() routes through without a token", () => {
		expect(new JwtAuthGuard(reflectorReturning(true)).canActivate(context())).toBe(true);
	});
});
