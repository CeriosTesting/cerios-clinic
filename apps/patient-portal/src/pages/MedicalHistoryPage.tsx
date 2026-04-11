import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api";
import { formatShortDate } from "../utils/formatDate";

export default function MedicalHistoryPage(): React.ReactElement {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		void api
			.get<{ data: Appointment[] }>("/appointments/history")
			.then(r => setAppointments(r.data.data))
			.catch(() => setError("Could not load medical history."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="max-w-3xl mx-auto">
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Medical History</h1>

			{loading && <p className="text-gray-400">Loading...</p>}
			{error && <p className="text-red-500">{error}</p>}

			{!loading && !error && appointments.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400">No completed appointments yet.</p>
				</div>
			)}

			{!loading && appointments.length > 0 && (
				<div className="space-y-4">
					{appointments.map(a => {
						const date = new Date(a.scheduledAt);
						const doctor = a.doctor?.user;
						return (
							<div key={a.id} className="card">
								<div className="flex items-start justify-between mb-2">
									<div>
										<p className="font-semibold text-brand-navy">
											Dr. {doctor?.firstName} {doctor?.lastName}
										</p>
										{a.doctor?.specialization && <p className="text-sm text-gray-400">{a.doctor.specialization}</p>}
									</div>
									<span className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatShortDate(date)}</span>
								</div>
								{a.notes ? (
									<p className="text-sm text-gray-600 whitespace-pre-wrap mt-2 border-t border-gray-100 pt-2">
										{a.notes}
									</p>
								) : (
									<p className="text-sm text-gray-300 mt-2 border-t border-gray-100 pt-2 italic">No notes recorded</p>
								)}
								<Link
									to={`/appointments/${a.id}`}
									className="text-brand-orange text-xs font-medium hover:underline mt-2 inline-block"
								>
									View details →
								</Link>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
