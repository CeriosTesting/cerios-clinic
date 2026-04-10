import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import api from "../api";

const STATUS_STYLES: Record<string, string> = {
	SCHEDULED: "bg-blue-100 text-blue-800",
	CONFIRMED: "bg-green-100 text-green-800",
	CANCELLED: "bg-red-100 text-red-800",
	COMPLETED: "bg-gray-100 text-gray-600",
};

const CANCELLABLE = ["SCHEDULED", "CONFIRMED"];

export default function AppointmentDetailPage(): React.ReactElement {
	const { id } = useParams<{ id: string }>();
	const [appointment, setAppointment] = useState<Appointment | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [cancelling, setCancelling] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	useEffect(() => {
		void api
			.get<{ data: Appointment }>(`/appointments/${id}`)
			.then(r => setAppointment(r.data.data))
			.catch(() => setError("Could not load appointment."))
			.finally(() => setLoading(false));
	}, [id]);

	const handleCancel = async (): Promise<void> => {
		setCancelling(true);
		setError("");
		try {
			const r = await api.patch<{ data: Appointment }>(`/appointments/${id}/cancel`);
			setAppointment(r.data.data);
			setShowConfirm(false);
		} catch {
			setError("Could not cancel appointment. Please try again.");
		} finally {
			setCancelling(false);
		}
	};

	if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
	if (error && !appointment)
		return (
			<div className="text-center py-16">
				<p className="text-red-500 mb-4">{error}</p>
				<Link to="/appointments" className="btn-outline">
					← Back to appointments
				</Link>
			</div>
		);
	if (!appointment)
		return (
			<div className="text-center py-16">
				<p className="text-red-500 mb-4">Appointment not found.</p>
				<Link to="/appointments" className="btn-outline">
					← Back to appointments
				</Link>
			</div>
		);

	const date = new Date(appointment.scheduledAt);
	const doctor = appointment.doctor?.user;
	const canCancel = CANCELLABLE.includes(appointment.status);

	return (
		<div className="max-w-2xl mx-auto">
			<Link to="/appointments" className="text-brand-orange hover:underline text-sm font-medium mb-6 inline-block">
				← Back to appointments
			</Link>
			<div className="card">
				<div className="flex items-start justify-between mb-6">
					<h1 className="text-2xl font-bold text-brand-navy">Appointment details</h1>
					<span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[appointment.status]}`}>
						{appointment.status}
					</span>
				</div>

				<dl className="space-y-4">
					<Row label="Doctor">
						Dr. {doctor?.firstName} {doctor?.lastName}
					</Row>
					<Row label="Specialization">{appointment.doctor?.specialization ?? "—"}</Row>
					<Row label="Date">
						{date.toLocaleDateString("en-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
					</Row>
					<Row label="Time">{date.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}</Row>
					{appointment.notes && (
						<Row label="Doctor's Notes">
							<span className="whitespace-pre-wrap">{appointment.notes}</span>
						</Row>
					)}
				</dl>

				{error && <p className="text-red-500 text-sm mt-4">{error}</p>}

				<CancelSection
					canCancel={canCancel}
					showConfirm={showConfirm}
					cancelling={cancelling}
					onRequestCancel={() => setShowConfirm(true)}
					onConfirmCancel={() => {
						void handleCancel();
					}}
					onKeep={() => setShowConfirm(false)}
				/>
			</div>
		</div>
	);
}

function CancelSection({
	canCancel,
	showConfirm,
	cancelling,
	onRequestCancel,
	onConfirmCancel,
	onKeep,
}: {
	canCancel: boolean;
	showConfirm: boolean;
	cancelling: boolean;
	onRequestCancel: () => void;
	onConfirmCancel: () => void;
	onKeep: () => void;
}): React.ReactElement | null {
	if (!canCancel) return null;
	return (
		<div className="mt-6 pt-4 border-t border-gray-100">
			{!showConfirm && (
				<button
					onClick={onRequestCancel}
					className="text-red-600 border border-red-300 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
				>
					Cancel appointment
				</button>
			)}
			{showConfirm && (
				<div>
					<p className="text-sm text-gray-600 mb-3">Are you sure you want to cancel this appointment?</p>
					<div className="flex gap-3">
						<button
							onClick={onConfirmCancel}
							disabled={cancelling}
							className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
						>
							{cancelling ? "Cancelling..." : "Yes, cancel it"}
						</button>
						<button onClick={onKeep} disabled={cancelling} className="btn-outline text-sm px-4 py-2">
							Keep appointment
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
	return (
		<div className="flex flex-col sm:flex-row sm:gap-4">
			<dt className="text-sm font-semibold text-gray-500 w-32 shrink-0">{label}</dt>
			<dd className="text-brand-navy font-medium">{children}</dd>
		</div>
	);
}
