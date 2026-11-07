/**
 * Shared helpers for unit tests. Import as `@clinic/test-utils` (alias in vitest.config.ts
 * and tsconfig.test.json). Not a workspace package, so it never ends up in a build or Docker image.
 */
import type { EventsService, MailService, PrismaService } from "@clinic/api-common";
import { vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";

export type PrismaMock = DeepMockProxy<PrismaService>;

/**
 * Deep Prisma mock: every `prisma.<model>.<method>` is a `vi.fn()`.
 * - `$transaction(cb)` runs `cb` against the same mock, so `tx.*` and `prisma.*` share stubs.
 * - All feature toggles are OFF by default (see {@link mockToggles}).
 */
export function createPrismaMock(): PrismaMock {
	const prisma = mockDeep<PrismaService>();
	prisma.$transaction.mockImplementation(((arg: unknown) =>
		typeof arg === "function" ? (arg as (tx: PrismaMock) => unknown)(prisma) : Promise.all(arg as unknown[])) as never);
	mockToggles(prisma, {});
	return prisma;
}

/**
 * Stubs `featureToggle.findUnique` / `findFirst` / `findMany` by key.
 * Keys that are not listed behave as "no row" (toggle OFF).
 *
 * @example mockToggles(prisma, { "bug:same-day-restriction": true })
 */
export function mockToggles(prisma: PrismaMock, toggles: Record<string, boolean>): void {
	const row = (key: string): { key: string; enabled: boolean } | null =>
		key in toggles ? { key, enabled: toggles[key] } : null;
	const byWhere = (args: unknown): Promise<{ key: string; enabled: boolean } | null> =>
		Promise.resolve(row((args as { where: { key: string } }).where.key));

	prisma.featureToggle.findUnique.mockImplementation(byWhere as never);
	prisma.featureToggle.findFirst.mockImplementation(byWhere as never);
	prisma.featureToggle.findMany.mockImplementation((() =>
		Promise.resolve(Object.entries(toggles).map(([key, enabled]) => ({ key, enabled })))) as never);
}

/** Freezes `new Date()` / `Date.now()` at the given ISO moment. Timers keep running normally. */
export function freezeTime(iso: string): Date {
	const now = new Date(iso);
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(now);
	return now;
}

export type MailMock = DeepMockProxy<MailService>;
export type EventsMock = DeepMockProxy<EventsService>;

export function createMailMock(): MailMock {
	const mail = mockDeep<MailService>();
	mail.sendAppointmentConfirmation.mockResolvedValue(undefined);
	mail.sendAppointmentCancellation.mockResolvedValue(undefined);
	mail.sendAppointmentReminder.mockResolvedValue(undefined);
	mail.sendWelcome.mockResolvedValue(undefined);
	mail.send.mockResolvedValue(undefined);
	return mail;
}

export function createEventsMock(): EventsMock {
	return mockDeep<EventsService>();
}

/** A minimal Keycloak token payload for controller calls that take `@CurrentUser()`. */
export function tokenFor(
	sub: string,
	roles: string[] = []
): {
	sub: string;
	email: string;
	given_name: string;
	family_name: string;
	realm_access: { roles: string[] };
} {
	return { sub, email: `${sub}@example.com`, given_name: "Test", family_name: "User", realm_access: { roles } };
}
