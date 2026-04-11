/**
 * Locale-aware date/time formatting helpers.
 * Uses `undefined` as the locale so the browser's `navigator.language` is
 * used automatically — no hardcoded locale strings.
 */

/** Full date, e.g. "Monday, 14 April 2026" */
export function formatDate(
	date: Date,
	options: Intl.DateTimeFormatOptions = {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	}
): string {
	return date.toLocaleDateString(undefined, options);
}

/** Short date, e.g. "14 Apr 2026" */
export function formatShortDate(date: Date): string {
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/** Time only, e.g. "09:30" */
export function formatTime(date: Date): string {
	return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Returns a YYYY-MM-DD string in UTC (for API query params) */
export function toUTCDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Returns tomorrow's UTC midnight as a Date */
export function tomorrowUTC(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Advances a UTC date by one calendar day */
export function addUTCDay(date: Date, days = 1): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Returns true if two Dates represent the same UTC calendar day */
export function isSameUTCDay(a: Date, b: Date): boolean {
	return (
		a.getUTCFullYear() === b.getUTCFullYear() &&
		a.getUTCMonth() === b.getUTCMonth() &&
		a.getUTCDate() === b.getUTCDate()
	);
}

/** Returns true when a Date falls on a UTC weekday (Mon–Fri) */
export function isUTCWeekday(date: Date): boolean {
	const dow = date.getUTCDay();
	return dow >= 1 && dow <= 5;
}

/** Advances a date to the next UTC weekday (skips Sat/Sun) */
export function nextUTCWeekday(date: Date): Date {
	let d = addUTCDay(date);
	while (!isUTCWeekday(d)) {
		d = addUTCDay(d);
	}
	return d;
}

/** Retreats a date to the previous UTC weekday (skips Sat/Sun), min bound = minDate */
export function prevUTCWeekday(date: Date, minDate: Date): Date {
	let d = addUTCDay(date, -1);
	while (!isUTCWeekday(d)) {
		d = addUTCDay(d, -1);
	}
	return d.getTime() >= minDate.getTime() ? d : minDate;
}
