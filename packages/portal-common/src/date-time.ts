const pad = (n: number): string => n.toString().padStart(2, "0");

/**
 * Converts a date (or ISO string) to the value format of an
 * `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`), in the browser's
 * local timezone. Returns an empty string for unparseable input.
 */
export function toDateTimeLocalValue(value: Date | string): string {
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converts a `datetime-local` input value (local time, no offset) to a UTC ISO
 * string, so the API does not have to guess the timezone.
 */
export function fromDateTimeLocalValue(value: string): string {
	return new Date(value).toISOString();
}
