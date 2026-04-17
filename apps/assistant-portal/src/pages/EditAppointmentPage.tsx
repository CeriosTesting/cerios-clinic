import type { Appointment, AppointmentStatusChange } from "@clinic/shared-types";
import { ALLOWED_TRANSITIONS } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api";

const STATUS_BADGE: Record<string, string> = {
	SCHEDULED: "badge-blue",
	CONFIRMED: "badge-green",
	COMPLETED: "badge-gray",
	CANCELLED: "badge-red",
};

interface FormValues {
	status: string;
	scheduledAt: Date | null;
	notes: string;
}

export default function EditAppointmentPage(): React.ReactElement | null {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { control, register, handleSubmit, reset } = useForm<FormValues>({
		defaultValues: { status: "", scheduledAt: null, notes: "" },
	});
	const [appointment, setAppointment] = useState<Appointment | null>(null);
	const [history, setHistory] = useState<
		(AppointmentStatusChange & { changedByName?: string | null; changedByRole?: string | null })[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		void Promise.all([
			api.get<{ data: Appointment }>(`/appointments/${id}`),
			api.get<{ data: typeof history }>(`/appointments/${id}/history`),
		])
			.then(([apptRes, histRes]) => {
				const a = apptRes.data.data;
				setAppointment(a);
				reset({
					status: a.status,
					scheduledAt: new Date(a.scheduledAt),
					notes: a.notes ?? "",
				});
				setHistory(histRes.data.data);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [id, reset]);

	const onSubmit = async (values: FormValues): Promise<void> => {
		setSubmitting(true);
		try {
			await api.put(`/appointments/${id}`, {
				status: values.status,
				scheduledAt: values.scheduledAt!.toISOString(),
				notes: values.notes ?? "",
			});
			toast.success("Appointment updated.");
			void navigate("/appointments");
		} catch (err: unknown) {
			toast.error(
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
					"Could not update appointment."
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
	if (!appointment) return <div className="text-center py-8 text-red-500">Appointment not found.</div>;

	const patient = appointment.patient?.user;
	const doctor = appointment.doctor?.user;
	const allowedNextStatuses = ALLOWED_TRANSITIONS[appointment.status] ?? [];
	const isTerminal = allowedNextStatuses.length === 0;

	return (
		<div className="max-w-lg">
			<button
				className="btn-link text-brand-accent pl-0"
				onClick={() => {
					void navigate("/appointments");
				}}
			>
				← Back
			</button>
			<h1 className="text-2xl font-bold text-brand-navy mt-2 mb-4">Edit appointment</h1>

			<div className="card mb-4">
				<p className="text-sm text-gray-600">
					<strong>Patient:</strong> {patient?.firstName} {patient?.lastName}
				</p>
				<p className="text-sm text-gray-600 mt-1">
					<strong>Doctor:</strong> Dr. {doctor?.firstName} {doctor?.lastName}
				</p>
			</div>

			<div className="card mb-4">
				<form
					onSubmit={e => {
						void handleSubmit(onSubmit)(e);
					}}
					className="space-y-4"
				>
					<div>
						<label className="form-label">Status</label>
						<Controller
							name="status"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<select {...field} disabled={isTerminal} className="form-input w-full">
									<option value={appointment.status}>{appointment.status} (current)</option>
									{allowedNextStatuses.map(s => (
										<option key={s} value={s}>
											{s}
										</option>
									))}
								</select>
							)}
						/>
						{isTerminal && (
							<p className="text-gray-400 text-xs mt-1">
								This appointment is in a terminal state and cannot be changed.
							</p>
						)}
					</div>

					<div>
						<label className="form-label">Date & Time</label>
						<Controller
							name="scheduledAt"
							control={control}
							rules={{ required: "Pick a date and time" }}
							render={({ field }) => (
								<DatePicker
									selected={field.value}
									onChange={field.onChange}
									showTimeSelect
									dateFormat="dd/MM/yyyy HH:mm"
									timeFormat="HH:mm"
									placeholderText="Select date and time"
									className="form-input w-full"
								/>
							)}
						/>
					</div>

					<div>
						<label className="form-label">Notes</label>
						<textarea {...register("notes")} rows={3} className="form-input w-full" />
					</div>

					{!isTerminal && (
						<button type="submit" className="btn-primary w-full" disabled={submitting}>
							{submitting ? "Saving..." : "Save changes"}
						</button>
					)}
				</form>
			</div>

			<div className="card">
				<h2 className="text-base font-semibold text-brand-navy mb-3">Status History</h2>
				{history.length === 0 ? (
					<p className="text-gray-400 text-sm">No history recorded.</p>
				) : (
					<div className="relative pl-6 space-y-4">
						{history.map((h, i) => (
							<div key={i} className="relative">
								<div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white bg-brand-primary" />
								{i < history.length - 1 && (
									<div className="absolute -left-[18px] top-4 w-0.5 h-full bg-gray-200" />
								)}
								<div>
									<span className={STATUS_BADGE[h.newStatus] ?? "badge-gray"}>
										{h.previousStatus ? `${h.previousStatus} → ${h.newStatus}` : `Created as ${h.newStatus}`}
									</span>
									<p className="text-xs text-gray-400 mt-1">
										{new Date(h.changedAt).toLocaleString("en-NL")}
										{h.changedByName ? ` · ${h.changedByName}` : ""}
										{h.changedByRole ? ` (${h.changedByRole})` : ""}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
