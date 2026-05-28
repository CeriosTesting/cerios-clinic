/** UTC-aware date utilities mirroring the web portal's utils/formatDate.ts */

export function formatDate(isoString: string): string {
	const d = new Date(isoString);
	return d.toLocaleDateString(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
}

export function formatTime(isoString: string): string {
	const d = new Date(isoString);
	return d.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function isSameDay(a: string, b: string): boolean {
	return toDateString(new Date(a)) === toDateString(new Date(b));
}

export function toDateString(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function tomorrowDate(): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + 1);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

export function isWeekday(date: Date): boolean {
	const day = date.getUTCDay();
	return day >= 1 && day <= 5;
}

export function nextWeekday(date: Date): Date {
	let d = new Date(date.getTime());
	do {
		d = new Date(d.getTime() + 86_400_000);
	} while (!isWeekday(d));
	return d;
}
