import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

export default function DashboardPage(): React.ReactElement {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);

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

	const scheduled = appointments.filter(a => a.status === "SCHEDULED");
	const confirmed = appointments.filter(a => a.status === "CONFIRMED");

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-2">Dashboard</h1>
			<p className="text-gray-400 text-sm mb-6">
				{new Date().toLocaleDateString("en-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
			</p>

			<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
				<StatCard label="Today's total" value={appointments.length} />
				<StatCard label="Scheduled" value={scheduled.length} />
				<StatCard label="Confirmed" value={confirmed.length} />
			</div>

			<div className="card">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Today's schedule</h2>
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && appointments.length === 0 && <p className="text-gray-400 text-sm">No appointments today.</p>}
				{!loading && appointments.length > 0 && (
					<div className="divide-y divide-gray-100">
						{appointments.map(a => {
							const date = new Date(a.scheduledAt);
							const patient = a.patient?.user;
							return (
								<div key={a.id} className="flex items-center justify-between py-3">
									<div className="flex items-center gap-4">
										<span className="text-sm text-gray-400 w-14 shrink-0">
											{date.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
										</span>
										<div>
											<p className="text-sm font-semibold text-brand-navy">
												{patient?.firstName} {patient?.lastName}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className={badgeClass(a.status)}>{a.status}</span>
										<Link
											to={`/appointments/${a.id}`}
											className="text-brand-orange text-xs font-medium hover:underline"
										>
											View
										</Link>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }): React.ReactElement {
	return (
		<div className="card text-center">
			<p className="text-3xl font-bold text-brand-orange">{value}</p>
			<p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
		</div>
	);
}
