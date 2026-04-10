import type { Appointment, AppointmentStatusChange } from "@clinic/shared-types";
import { ALLOWED_TRANSITIONS as TRANSITIONS } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import api from "../api";

function badgeClass(status: string): string {
	const map: Record<string, string> = {
		SCHEDULED: "badge-scheduled",
		CONFIRMED: "badge-confirmed",
		COMPLETED: "badge-completed",
		CANCELLED: "badge-cancelled",
	};
	return map[status] ?? "badge-scheduled";
}

export default function AppointmentDetailPage(): React.ReactElement {
	const { id } = useParams<{ id: string }>();
	const [appointment, setAppointment] = useState<Appointment | null>(null);
	const [history, setHistory] = useState<
		(AppointmentStatusChange & { changedByName?: string | null; changedByRole?: string | null })[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({ status: "", notes: "", scheduledAt: "" });
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		void Promise.all([
			api.get<{ data: Appointment }>(`/appointments/${id}`),
			api.get<{ data: typeof history }>(`/appointments/${id}/history`),
		])
			.then(([apptRes, histRes]) => {
				const a = apptRes.data.data;
				setAppointment(a);
				setForm({
					status: a.status,
					notes: a.notes ?? "",
					scheduledAt: new Date(a.scheduledAt).toISOString().slice(0, 16),
				});
				setHistory(histRes.data.data);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [id]);

	const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSaving(true);
		setSuccess(false);
		setError("");
		try {
			const updated = await api.put<{ data: Appointment }>(`/appointments/${id}`, form);
			const histRes = await api.get<{ data: typeof history }>(`/appointments/${id}/history`);
			setAppointment(updated.data.data);
			setHistory(histRes.data.data);
			setSuccess(true);
		} catch (err: unknown) {
			setError(
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not save changes."
			);
		} finally {
			setSaving(false);
		}
	};

	if (loading) return <div className="text-gray-400 py-16 text-center">Loading...</div>;
	if (!appointment) return <div className="text-red-500 py-16 text-center">Appointment not found.</div>;

	const patient = appointment.patient?.user;
	const allowedNextStatuses = TRANSITIONS[appointment.status] ?? [];

	return (
		<div className="max-w-2xl">
			<Link to="/appointments" className="text-brand-orange text-sm font-medium hover:underline mb-6 inline-block">
				← Back to appointments
			</Link>

			<div className="card mb-4">
				<div className="flex items-start justify-between mb-4">
					<h1 className="text-xl font-bold text-brand-navy">Appointment</h1>
					<span className={badgeClass(appointment.status)}>{appointment.status}</span>
				</div>
				<p className="text-sm text-gray-500">
					Patient:{" "}
					<Link to={`/patients/${appointment.patientId}`} className="text-brand-orange font-semibold hover:underline">
						{patient?.firstName} {patient?.lastName}
					</Link>
				</p>
			</div>

			<form
				onSubmit={e => {
					void handleSave(e);
				}}
				className="card space-y-4 mb-4"
			>
				<h2 className="font-semibold text-brand-navy">Edit appointment</h2>

				<div>
					<label className="form-label">Status</label>
					{allowedNextStatuses.length === 0 ? (
						<p className="text-sm text-gray-400 italic">
							This appointment is in a terminal state and cannot be changed.
						</p>
					) : (
						<select
							value={form.status}
							onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
							className="form-input"
						>
							<option value={appointment.status}>{appointment.status} (current)</option>
							{allowedNextStatuses.map(s => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					)}
				</div>

				<div>
					<label className="form-label">Scheduled at</label>
					<input
						type="datetime-local"
						value={form.scheduledAt}
						onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
						className="form-input"
					/>
				</div>

				<div>
					<label className="form-label">Notes</label>
					<textarea
						value={form.notes}
						onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
						rows={4}
						className="form-input resize-none"
					/>
				</div>

				{success && <p className="text-green-600 text-sm font-medium">Changes saved.</p>}
				{error && <p className="text-red-500 text-sm">{error}</p>}

				{allowedNextStatuses.length > 0 && (
					<button type="submit" className="btn-primary" disabled={saving}>
						{saving ? "Saving..." : "Save changes"}
					</button>
				)}
			</form>

			{/* Status History */}
			<StatusHistory history={history} />
		</div>
	);
}

function StatusHistory({
	history,
}: {
	history: (AppointmentStatusChange & { changedByName?: string | null; changedByRole?: string | null })[];
}): React.ReactElement {
	return (
		<div className="card">
			<h2 className="font-semibold text-brand-navy mb-4">Status History</h2>
			{history.length === 0 ? (
				<p className="text-sm text-gray-400 italic">No history recorded.</p>
			) : (
				<ol className="relative border-l border-gray-200 space-y-4 ml-2">
					{history.map((h, _i) => (
						<li key={h.id} className="ml-4">
							<span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-brand-orange border-2 border-white" />
							<p className="text-sm font-semibold text-brand-navy">
								{h.previousStatus ? `${h.previousStatus} → ${h.newStatus}` : `Created as ${h.newStatus}`}
							</p>
							<p className="text-xs text-gray-400">
								{new Date(h.changedAt).toLocaleString("en-NL")}
								{h.changedByName ? ` · ${h.changedByName}` : ""}
								{h.changedByRole ? ` (${h.changedByRole})` : ""}
							</p>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}
