import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

const STATUS_BADGE: Record<string, string> = {
	SCHEDULED: "badge-blue",
	CONFIRMED: "badge-green",
	COMPLETED: "badge-gray",
	CANCELLED: "badge-red",
};

export default function DashboardPage(): React.ReactElement {
	const navigate = useNavigate();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	useEffect(() => {
		const today = new Date();
		const from = new Date(today.setHours(0, 0, 0, 0)).toISOString();
		const to = new Date(today.setHours(23, 59, 59, 999)).toISOString();
		void api
			.get<{ data: Appointment[] }>("/appointments", { params: { from, to } })
			.then(r => setAppointments(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const q = search.toLowerCase();
	const filtered = q
		? appointments.filter(a => {
				const patient = `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`.toLowerCase();
				const doctor = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
				return patient.includes(q) || doctor.includes(q);
			})
		: appointments;

	const scheduled = appointments.filter(a => a.status === "SCHEDULED").length;
	const confirmed = appointments.filter(a => a.status === "CONFIRMED").length;

	return (
		<div>
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<h1 className="text-2xl font-bold text-brand-navy">Dashboard</h1>
				<button
					className="btn-primary"
					onClick={() => {
						void navigate("/appointments/create");
					}}
				>
					+ New appointment
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				<div className="card text-center">
					<p className="text-3xl font-bold text-brand-accent">{appointments.length}</p>
					<p className="text-xs text-gray-400 mt-1 font-medium">Today&apos;s total</p>
				</div>
				<div className="card text-center">
					<p className="text-3xl font-bold text-blue-600">{scheduled}</p>
					<p className="text-xs text-gray-400 mt-1 font-medium">Scheduled</p>
				</div>
				<div className="card text-center">
					<p className="text-3xl font-bold text-green-600">{confirmed}</p>
					<p className="text-xs text-gray-400 mt-1 font-medium">Confirmed</p>
				</div>
			</div>

			<div className="card">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Today&apos;s schedule</h2>
				<input
					type="text"
					placeholder="Search patient or doctor"
					className="form-input max-w-xs mb-4"
					value={search}
					onChange={e => setSearch(e.target.value)}
				/>
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && filtered.length === 0 && <p className="text-gray-400 text-sm">No appointments found.</p>}
				{!loading && filtered.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[600px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-20">Time</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Patient</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Doctor</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-28">Status</th>
									<th className="px-3 py-2 w-16"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{filtered.map(a => (
									<tr key={a.id} className="hover:bg-gray-50 transition-colors">
										<td className="px-3 py-2 text-gray-500">
											{new Date(a.scheduledAt).toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
										</td>
										<td className="px-3 py-2 font-medium text-brand-navy">
											{a.patient?.user?.firstName} {a.patient?.user?.lastName}
										</td>
										<td className="px-3 py-2 text-gray-600">
											Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}
										</td>
										<td className="px-3 py-2">
											<span className={STATUS_BADGE[a.status] ?? "badge-gray"}>{a.status}</span>
										</td>
										<td className="px-3 py-2">
											<button
												className="btn-link"
												onClick={() => {
													void navigate(`/appointments/${a.id}/edit`);
												}}
											>
												Edit
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
