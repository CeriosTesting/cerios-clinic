import React, { useEffect, useState } from "react";

interface UnavailabilityBlock {
	id: string;
	startDate: string;
	endDate: string;
	reason?: string | null;
	createdAt: string;
}

import api from "../api";

/** Step for datetime-local inputs, in seconds (15-minute grid, matching the 30-min slot boundaries). */
const STEP_SECONDS = 15 * 60;
const STEP_MS = STEP_SECONDS * 1000;

function formatDateOnly(iso: string): string {
	return new Date(iso).toLocaleDateString("en-NL", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString("en-NL", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** True when a date is local-midnight (00:00:00.000). */
function isLocalMidnight(d: Date): boolean {
	return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

/** Renders a block as either "Full day(s)" or a datetime range. */
function formatBlockRange(startIso: string, endIso: string): string {
	const start = new Date(startIso);
	const end = new Date(endIso);
	// Full-day blocks are stored as start=00:00 and end=00:00 of the day after the last covered day.
	if (isLocalMidnight(start) && isLocalMidnight(end)) {
		const lastDay = new Date(end.getTime() - 86_400_000);
		const startStr = formatDateOnly(start.toISOString());
		if (start.getTime() === lastDay.getTime()) {
			return `${startStr} — Full day`;
		}
		return `${startStr} — ${formatDateOnly(lastDay.toISOString())} — Full day`;
	}
	return `${formatDateTime(startIso)} → ${formatDateTime(endIso)}`;
}

/** Rounds a datetime-local value string to the nearest STEP (defensive, in case a browser ignores `step`). */
function roundToStep(value: string): string {
	if (!value) return value;
	const d = new Date(value);
	if (isNaN(d.getTime())) return value;
	const rounded = new Date(Math.round(d.getTime() / STEP_MS) * STEP_MS);
	// Produce local "YYYY-MM-DDTHH:mm" (what datetime-local uses)
	const pad = (n: number): string => n.toString().padStart(2, "0");
	return `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}T${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
}

/** Converts a "YYYY-MM-DD" date string to an ISO string at local midnight. */
function dateStringToLocalMidnightIso(dateStr: string): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** Adds a given number of days to a "YYYY-MM-DD" date string and returns a local-midnight ISO string. */
function addDaysToDateString(dateStr: string, days: number): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d + days, 0, 0, 0, 0).toISOString();
}

export default function AvailabilityPage(): React.ReactElement {
	const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
	const [loading, setLoading] = useState(true);
	const [allDay, setAllDay] = useState(false);
	const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const fetchBlocks = (): void => {
		void api
			.get<{ data: UnavailabilityBlock[] }>("/availability")
			.then(r => setBlocks(r.data.data))
			.catch(() => setError("Could not load unavailability blocks."))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchBlocks();
	}, []);

	const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			let payload: { startDate: string; endDate: string; reason: string };
			if (allDay) {
				// In all-day mode the inputs hold "YYYY-MM-DD" strings.
				if (!form.startDate || !form.endDate) {
					throw new Error("Please select both a start and an end date.");
				}
				payload = {
					startDate: dateStringToLocalMidnightIso(form.startDate),
					// End date is inclusive in the UI → store as next day 00:00 local (half-open interval).
					endDate: addDaysToDateString(form.endDate, 1),
					reason: form.reason,
				};
			} else {
				const startRounded = roundToStep(form.startDate);
				const endRounded = roundToStep(form.endDate);
				payload = {
					startDate: new Date(startRounded).toISOString(),
					endDate: new Date(endRounded).toISOString(),
					reason: form.reason,
				};
			}
			await api.post("/availability", payload);
			setSuccess("Time-off block created.");
			setForm({ startDate: "", endDate: "", reason: "" });
			fetchBlocks();
		} catch (err: unknown) {
			const msg =
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
				(err instanceof Error ? err.message : undefined);
			setError(msg ?? "Could not create block.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: string): Promise<void> => {
		try {
			await api.delete(`/availability/${id}`);
			setBlocks(prev => prev.filter(b => b.id !== id));
		} catch {
			setError("Could not delete block.");
		}
	};

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Manage Availability</h1>

			{/* Add new block */}
			<div className="card mb-8">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Add time off</h2>
				<form
					onSubmit={e => {
						void handleSubmit(e);
					}}
					className="space-y-4"
				>
					<label className="inline-flex items-center gap-2 text-sm text-gray-600">
						<input
							type="checkbox"
							checked={allDay}
							onChange={e => {
								setAllDay(e.target.checked);
								setForm(f => ({ ...f, startDate: "", endDate: "" }));
							}}
							className="rounded border-gray-300"
						/>
						All day
					</label>
					<div className="grid sm:grid-cols-4 gap-4 items-end">
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="startDate">
								{allDay ? "Start date" : "Start"}
							</label>
							<input
								id="startDate"
								type={allDay ? "date" : "datetime-local"}
								step={allDay ? undefined : STEP_SECONDS}
								value={form.startDate}
								onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="endDate">
								{allDay ? "End date (inclusive)" : "End"}
							</label>
							<input
								id="endDate"
								type={allDay ? "date" : "datetime-local"}
								step={allDay ? undefined : STEP_SECONDS}
								value={form.endDate}
								onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="reason">
								Reason (optional)
							</label>
							<input
								id="reason"
								type="text"
								value={form.reason}
								onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
								placeholder="e.g. Vacation"
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
							/>
						</div>
						<button type="submit" disabled={submitting} className="btn-primary h-10">
							{submitting ? "Adding..." : "Add block"}
						</button>
					</div>
				</form>
				{error && <p className="text-red-500 text-sm mt-3">{error}</p>}
				{success && <p className="text-green-600 text-sm mt-3">{success}</p>}
			</div>

			{/* Existing blocks */}
			<div className="card">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Scheduled time off</h2>
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && blocks.length === 0 && <p className="text-gray-400 text-sm">No time-off blocks scheduled.</p>}
				{!loading && blocks.length > 0 && (
					<div className="divide-y divide-gray-100">
						{blocks.map(block => (
							<div key={block.id} className="flex items-center justify-between py-3">
								<div>
									<p className="text-sm font-medium text-brand-navy">
										{formatBlockRange(block.startDate, block.endDate)}
									</p>
									{block.reason && <p className="text-xs text-gray-400">{block.reason}</p>}
								</div>
								<button
									onClick={() => {
										void handleDelete(block.id);
									}}
									className="text-red-500 text-xs hover:underline"
								>
									Delete
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
