import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { createPrismaMock, mockToggles, tokenFor, type PrismaMock } from "@clinic/test-utils";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";

import { ProfileController } from "./profile.controller";
import { validateProfileDto, type ProfileInput } from "./profile.validation";

describe("validateProfileDto", () => {
	it.each<[string, ProfileInput]>([
		["an empty update", {}],
		[
			"a full valid profile",
			{ firstName: "Pat", lastName: "Jones", phone: "+31 6 1234 5678", dateOfBirth: "1990-05-17" },
		],
		["a cleared phone and date of birth", { phone: "", dateOfBirth: "" }],
		["phone with brackets and dashes", { phone: "(020) 123-4567" }],
		["50-character names", { firstName: "a".repeat(50), lastName: "b".repeat(50) }],
		["30-character insurance number", { insuranceNumber: "x".repeat(30) }],
	])("accepts %s", (_label, dto) => {
		expect(validateProfileDto(dto)).toEqual([]);
	});

	it.each<[string, ProfileInput, string]>([
		["a blank first name", { firstName: "   " }, "First name is required and must be at most 50 characters"],
		[
			"a 51-character last name",
			{ lastName: "b".repeat(51) },
			"Last name is required and must be at most 50 characters",
		],
		["letters in the phone number", { phone: "call me maybe" }, "Invalid phone number format"],
		["a too short phone number", { phone: "12345" }, "Invalid phone number format"],
		["a date of birth in the future", { dateOfBirth: "2999-01-01" }, "Date of birth must be a valid date in the past"],
		["an unparseable date of birth", { dateOfBirth: "yesterday" }, "Date of birth must be a valid date in the past"],
		[
			"a 31-character insurance number",
			{ insuranceNumber: "x".repeat(31) },
			"Insurance number must be at most 30 characters",
		],
	])("rejects %s", (_label, dto, message) => {
		expect(validateProfileDto(dto)).toEqual([message]);
	});

	it("reports all problems at once", () => {
		expect(validateProfileDto({ firstName: "", phone: "abc" })).toHaveLength(2);
	});
});

describe("PUT /profile", () => {
	const BACKEND_BUG = FEATURE_TOGGLE_KEYS.PROFILE_VALIDATION_BACKEND;
	const invalid = { firstName: "", phone: "not a phone" };
	let prisma: PrismaMock;
	let controller: ProfileController;

	beforeEach(() => {
		prisma = createPrismaMock();
		controller = new ProfileController(prisma as unknown as PrismaService);
		prisma.user.findUnique.mockResolvedValue({ id: "user-1", patient: { id: "pat-1" } } as never);
		prisma.user.update.mockResolvedValue({ id: "user-1" } as never);
	});

	describe(`${BACKEND_BUG} OFF (correct: server validates)`, () => {
		it("rejects invalid input and does not save", async () => {
			await expect(controller.updateProfile(tokenFor("kc-1"), invalid)).rejects.toThrow(BadRequestException);
			expect(prisma.user.update).not.toHaveBeenCalled();
		});
	});

	describe(`${BACKEND_BUG} ON (deliberate bug: no server validation)`, () => {
		it("saves invalid input", async () => {
			mockToggles(prisma, { [BACKEND_BUG]: true });
			await controller.updateProfile(tokenFor("kc-1"), invalid);
			expect(prisma.user.update).toHaveBeenCalled();
		});
	});
});
