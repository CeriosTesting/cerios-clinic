/**
 * Appointment scheduling rules, shared by the APIs and the portals.
 *
 * All rules work in UTC: working hours are 09:00–17:00 UTC on weekdays (Mon–Fri),
 * in 30-minute slots. Functions are pure; "now" can be passed in for testing.
 * Validation helpers return an error message (or `null`), so callers decide
 * which exception to throw.
 */

/** Slot duration in minutes */
export const SLOT_MINUTES = 30;
/** First working hour (UTC, inclusive) */
export const WORK_START_HOUR = 9;
/** End of working hours (UTC, exclusive) */
export const WORK_END_HOUR = 17;
/** Maximum number of days the slot overview may span */
export const MAX_SLOT_RANGE_DAYS = 7;

const DAY_MS = 86_400_000;

/** Returns midnight UTC of the given moment's UTC day. */
export function startOfUTCDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Returns today's UTC midnight. */
export function todayUTC(now: Date = new Date()): Date {
	return startOfUTCDay(now);
}

/** Returns tomorrow's UTC midnight. */
export function tomorrowUTC(now: Date = new Date()): Date {
	return new Date(todayUTC(now).getTime() + DAY_MS);
}

/** Returns true when a Date falls on a UTC weekday (Mon–Fri). */
export function isUTCWeekday(date: Date): boolean {
	const dow = date.getUTCDay(); // 0=Sun, 6=Sat
	return dow >= 1 && dow <= 5;
}

/** Returns true if two Dates are on the same UTC calendar day. */
export function isSameUTCDay(a: Date, b: Date): boolean {
	return startOfUTCDay(a).getTime() === startOfUTCDay(b).getTime();
}

/** Returns all slot start times (UTC hour/minute pairs) for one working day. */
export function buildDaySlots(): Array<{ hour: number; minute: number }> {
	const slots: Array<{ hour: number; minute: number }> = [];
	for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
		for (let m = 0; m < 60; m += SLOT_MINUTES) {
			slots.push({ hour: h, minute: m });
		}
	}
	return slots;
}

export type ParseResult<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/** Parses a `YYYY-MM-DD` string as a UTC midnight Date. */
export function parseUTCDateOnly(raw: string): ParseResult<Date> {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return { error: `Invalid date format "${raw}". Expected YYYY-MM-DD.` };
	}
	const d = new Date(`${raw}T00:00:00.000Z`);
	if (isNaN(d.getTime())) {
		return { error: `Invalid date "${raw}".` };
	}
	return { value: d };
}

/**
 * Validates the `from`/`to` query of the slot overview: both required, `YYYY-MM-DD`,
 * `from` tomorrow or later, `to` not before `from`, at most {@link MAX_SLOT_RANGE_DAYS} days.
 */
export function parseSlotRange(
	fromRaw: string | undefined,
	toRaw: string | undefined,
	now: Date = new Date()
): ParseResult<{ from: Date; to: Date }> {
	if (!fromRaw || !toRaw) {
		return { error: "Query params 'from' and 'to' are required." };
	}
	const from = parseUTCDateOnly(fromRaw);
	if (from.error !== undefined) return { error: from.error };
	const to = parseUTCDateOnly(toRaw);
	if (to.error !== undefined) return { error: to.error };

	if (from.value < tomorrowUTC(now)) {
		return { error: "'from' must be tomorrow or later." };
	}
	if (to.value < from.value) {
		return { error: "'to' must not be before 'from'." };
	}
	const diffDays = Math.round((to.value.getTime() - from.value.getTime()) / DAY_MS);
	if (diffDays > MAX_SLOT_RANGE_DAYS - 1) {
		return { error: `Date range must not exceed ${MAX_SLOT_RANGE_DAYS} days.` };
	}
	return { value: { from: from.value, to: to.value } };
}

/**
 * Validates that an ISO datetime is a bookable slot. Returns an error message, or `null` when valid:
 * - tomorrow or later (UTC date comparison)
 * - on a UTC weekday
 * - within working hours [WORK_START_HOUR, WORK_END_HOUR)
 * - aligned to a SLOT_MINUTES boundary (no seconds/milliseconds)
 */
export function getSlotTimeError(iso: string, now: Date = new Date()): string | null {
	const d = new Date(iso);
	if (isNaN(d.getTime())) {
		return "Invalid scheduledAt datetime.";
	}
	if (startOfUTCDay(d) < tomorrowUTC(now)) {
		return "Appointments can only be rescheduled to tomorrow or later.";
	}
	if (!isUTCWeekday(d)) {
		return "Appointments can only be scheduled on weekdays (Mon–Fri).";
	}
	const h = d.getUTCHours();
	if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
		return `Appointments must be within working hours (${WORK_START_HOUR}:00–${WORK_END_HOUR}:00 UTC).`;
	}
	if (d.getUTCMinutes() % SLOT_MINUTES !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) {
		return `Appointment time must align to a ${SLOT_MINUTES}-minute slot boundary.`;
	}
	return null;
}

export interface TimeBlock {
	startDate: Date;
	endDate: Date;
}

/**
 * Lists the free slots per weekday between `from` and `to` (inclusive, UTC midnights).
 * A slot is taken when it is booked, or when it falls in a block (`start <= slot < end`).
 * Weekend days are left out.
 */
export function buildAvailableSlots(options: {
	from: Date;
	to: Date;
	booked: Date[];
	unavailable: TimeBlock[];
}): Array<{ date: string; slots: string[] }> {
	const bookedTimes = new Set(options.booked.map(d => d.toISOString()));
	const isUnavailable = (slot: Date): boolean =>
		options.unavailable.some(block => slot >= block.startDate && slot < block.endDate);

	const daySlots = buildDaySlots();
	const result: Array<{ date: string; slots: string[] }> = [];
	const cursor = new Date(options.from);

	while (cursor <= options.to) {
		if (isUTCWeekday(cursor)) {
			const slots: string[] = [];
			for (const { hour, minute } of daySlots) {
				const slot = new Date(
					Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), hour, minute, 0, 0)
				);
				if (!bookedTimes.has(slot.toISOString()) && !isUnavailable(slot)) {
					slots.push(slot.toISOString());
				}
			}
			result.push({ date: cursor.toISOString().slice(0, 10), slots });
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return result;
}
