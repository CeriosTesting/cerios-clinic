import type { Appointment } from "@clinic/shared-types";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

const STATUS_BADGE: Record<string, string> = {
	SCHEDULED: "badge-blue",
	CONFIRMED: "badge-green",
	COMPLETED: "badge-gray",
	CANCELLED: "badge-red",
};

export default function AppointmentsPage(): React.ReactElement {
	const navigate = useNavigate();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

	const load = useCallback(() => {
		setLoading(true);
		void api
			.get<{ data: Appointment[] }>("/appointments")
			.then(r => setAppointments(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const q = search.toLowerCase();
	const filtered = q
		? appointments.filter(a => {
				const patient = `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`.toLowerCase();
				const doctor = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
				return patient.includes(q) || doctor.includes(q);
			})
		: appointments;

	const handleCancel = async (id: string): Promise<void> => {
		await api.delete(`/appointments/${id}`);
		setCancelConfirm(null);
		load();
	};

	return (
		<div>
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<h1 className="text-2xl font-bold text-brand-navy">Appointments</h1>
				<button
					className="btn-primary"
					onClick={() => {
						void navigate("/appointments/create");
					}}
				>
					+ New appointment
				</button>
			</div>

			<div className="card mb-4">
				<input
					type="text"
					placeholder="Search patient or doctor"
					className="form-input max-w-xs"
					value={search}
					onChange={e => setSearch(e.target.value)}
				/>
			</div>

			<div className="card">
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && filtered.length === 0 && <p className="text-gray-400 text-sm">No appointments found.</p>}
				{!loading && filtered.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[700px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Date & Time</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Patient</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Doctor</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-28">Status</th>
									<th className="px-3 py-2 w-36"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{filtered.map(a => {
									const d = new Date(a.scheduledAt);
									return (
										<tr key={a.id} className="hover:bg-gray-50 transition-colors">
											<td className="px-3 py-2 text-gray-600">
												{d.toLocaleDateString("en-NL")} {d.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
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
												<div className="flex gap-2 items-center relative">
													<button
														className="btn-link"
														onClick={() => {
															void navigate(`/appointments/${a.id}/edit`);
														}}
													>
														Edit
													</button>
													{a.status !== "CANCELLED" && a.status !== "COMPLETED" && (
														<>
															<button
																className="btn-link-danger"
																onClick={() => setCancelConfirm(a.id)}
															>
																Cancel
															</button>
															{cancelConfirm === a.id && (
																<div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-[180px]">
																	<p className="text-sm text-gray-600 mb-2">Cancel this appointment?</p>
																	<div className="flex gap-2 justify-end">
																		<button className="btn-ghost text-xs" onClick={() => setCancelConfirm(null)}>No</button>
																		<button
																			className="btn-primary text-xs"
																			onClick={() => {
																				void handleCancel(a.id);
																			}}
																		>
																			Yes
																		</button>
																	</div>
																</div>
															)}
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
