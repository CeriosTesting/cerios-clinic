import { formatDateOnly } from "@clinic/portal-common";
import type { Patient, Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import api from "../api";

interface PatientDetail {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	patient: Patient & {
		appointments?: Appointment[];
	};
}

function badgeClass(status: string): string {
	const map: Record<string, string> = {
		SCHEDULED: "badge-scheduled",
		CONFIRMED: "badge-confirmed",
		COMPLETED: "badge-completed",
		CANCELLED: "badge-cancelled",
	};
	return map[status] ?? "badge-scheduled";
}

export default function PatientDetailPage(): React.ReactElement {
	const { id } = useParams<{ id: string }>();
	const [patient, setPatient] = useState<PatientDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		void api
			.get<{ data: PatientDetail }>(`/patients/${id}`)
			.then(r => setPatient(r.data.data))
			.catch(() => setError("Could not load patient."))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) return <div className="text-gray-400 py-16 text-center">Loading...</div>;
	if (error || !patient)
		return (
			<div className="text-center py-16">
				<p className="text-red-500 mb-4">{error || "Patient not found."}</p>
			</div>
		);

	return (
		<div className="max-w-2xl">
			<Link to="/appointments" className="text-brand-orange text-sm font-medium hover:underline mb-6 inline-block">
				← Back
			</Link>

			<div className="card mb-6">
				<div className="flex items-start gap-6 mb-4">
					<img
						src={patient.patient?.photo ?? "/placeholder-avatar.svg"}
						alt={`${patient.firstName} ${patient.lastName}`}
						style={{ width: 90, height: 120 }}
						className="rounded-lg object-cover border border-gray-200 flex-shrink-0"
					/>
					<div className="flex-1">
						<h1 className="text-xl font-bold text-brand-navy mb-4">
							{patient.firstName} {patient.lastName}
						</h1>
						<dl className="grid grid-cols-2 gap-4 text-sm">
							<Row label="Email" value={patient.email} />
							<Row label="Phone" value={patient.patient?.phone ?? "—"} />
							<Row
								label="Date of birth"
								value={patient.patient?.dateOfBirth ? formatDateOnly(patient.patient.dateOfBirth, "en-NL") : "—"}
							/>
							<Row label="Insurance #" value={patient.patient?.insuranceNumber ?? "—"} />
						</dl>
					</div>
				</div>
			</div>

			<div className="card">
				<h2 className="font-semibold text-brand-navy mb-4">Recent appointments</h2>
				<AppointmentList appointments={patient.patient?.appointments} />
			</div>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
	return (
		<div>
			<dt className="text-xs font-semibold text-gray-400 uppercase mb-0.5">{label}</dt>
			<dd className="font-medium text-brand-navy">{value}</dd>
		</div>
	);
}

function AppointmentList({ appointments }: { appointments?: Appointment[] }): React.ReactElement {
	if (!appointments?.length) {
		return <p className="text-gray-400 text-sm">No appointments found.</p>;
	}
	return (
		<div className="space-y-3">
			{appointments.map(a => {
				const date = new Date(a.scheduledAt);
				return (
					<div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
						<div>
							<p className="text-sm text-gray-500">
								{date.toLocaleDateString("en-NL")}{" "}
								{date.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<span className={badgeClass(a.status)}>{a.status}</span>
							<Link to={`/appointments/${a.id}`} className="text-brand-orange text-xs font-medium hover:underline">
								View
							</Link>
						</div>
					</div>
				);
			})}
		</div>
	);
}
