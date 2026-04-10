import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api";

const STATUS_STYLES: Record<string, string> = {
	SCHEDULED: "bg-blue-100 text-blue-800",
	CONFIRMED: "bg-green-100 text-green-800",
	CANCELLED: "bg-red-100 text-red-800",
	COMPLETED: "bg-gray-100 text-gray-600",
};

export default function AppointmentsPage(): React.ReactElement {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	useEffect(() => {
		void api
			.get<{ data: Appointment[] }>("/appointments")
			.then(r => setAppointments(r.data.data))
			.catch(() => setError("Could not load appointments."))
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
	if (error) return <div className="text-center py-16 text-red-500">{error}</div>;

	const q = search.toLowerCase();
	const visible = q
		? appointments.filter(a => {
				const name = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
				return name.includes(q);
			})
		: appointments;

	const upcoming = visible.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status));
	const past = visible.filter(a => ["COMPLETED", "CANCELLED"].includes(a.status));

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-6">My Appointments</h1>

			<div className="mb-6">
				<input
					type="text"
					placeholder="Search by doctor name..."
					value={search}
					onChange={e => setSearch(e.target.value)}
					className="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange"
				/>
			</div>

			{upcoming.length === 0 && past.length === 0 && (
				<div className="card text-center py-12 text-gray-400">
					<p className="text-4xl mb-3">📅</p>
					<p className="font-medium">No appointments found.</p>
					<p className="text-sm mt-1">Contact your clinic to schedule an appointment.</p>
				</div>
			)}

			{upcoming.length > 0 && (
				<section className="mb-8">
					<h2 className="text-lg font-semibold text-brand-navy mb-3">Upcoming</h2>
					<div className="space-y-3">
						{upcoming.map(appt => (
							<AppointmentCard key={appt.id} appt={appt} />
						))}
					</div>
				</section>
			)}

			{past.length > 0 && (
				<section>
					<h2 className="text-lg font-semibold text-brand-navy mb-3">Past</h2>
					<div className="space-y-3">
						{past.map(appt => (
							<AppointmentCard key={appt.id} appt={appt} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function AppointmentCard({ appt }: { appt: Appointment }): React.ReactElement {
	const date = new Date(appt.scheduledAt);
	const doctor = appt.doctor?.user;
	return (
		<Link
			to={`/appointments/${appt.id}`}
			className="card flex items-center justify-between hover:shadow-md transition-shadow"
		>
			<div>
				<p className="font-semibold text-brand-navy">
					Dr. {doctor?.firstName} {doctor?.lastName}
				</p>
				<p className="text-sm text-gray-500">{appt.doctor?.specialization}</p>
				<p className="text-sm text-gray-400 mt-1">
					{date.toLocaleDateString("en-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
					{" · "}
					{date.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
				</p>
			</div>
			<span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[appt.status]}`}>
				{appt.status}
			</span>
		</Link>
	);
}
