import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@clinic/portal-common";

/**
 * Value for the "Scheduled at" input. With the `bug:appointment-timezone`
 * toggle on, it shows the UTC time as if it were local (deliberate bug).
 */
export function scheduledAtInputValue(scheduledAt: string, timezoneBug: boolean): string {
	return timezoneBug ? new Date(scheduledAt).toISOString().slice(0, 16) : toDateTimeLocalValue(scheduledAt);
}

/**
 * Value sent to the API for the "Scheduled at" input. With the `bug:appointment-timezone`
 * toggle on, it sends the raw local value without timezone, so the server interprets it
 * in its own timezone (deliberate bug).
 */
export function scheduledAtPayload(inputValue: string, timezoneBug: boolean): string | undefined {
	if (timezoneBug) return inputValue;
	return inputValue ? fromDateTimeLocalValue(inputValue) : undefined;
}
