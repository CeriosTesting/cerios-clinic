import type { Prescription } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-NL", { year: "numeric", month: "short", day: "numeric" });
}

export default function PrescriptionsPage(): React.ReactElement {
	const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);

	useEffect(() => {
		void api
			.get<{ data: Prescription[] }>("/prescriptions")
			.then(r => setPrescriptions(r.data.data))
			.catch(() => setError("Could not load prescriptions."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-brand-navy">Prescriptions</h1>
			</div>

			{loading && <p className="text-gray-400 text-sm">Loading...</p>}
			{error && <p className="text-red-500 text-sm">{error}</p>}

			{!loading && !error && prescriptions.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400">No prescriptions created yet.</p>
					<p className="text-sm text-gray-300 mt-1">Create a prescription from a completed appointment.</p>
				</div>
			)}

			{!loading && prescriptions.length > 0 && (
				<div className="space-y-4">
					{prescriptions.map(p => {
						const patient = p.patient?.user;
						const isExpanded = expandedId === p.id;
						return (
							<div key={p.id} className="card">
								<div className="flex items-start justify-between mb-2">
									<div>
										<p className="font-semibold text-brand-navy">
											{patient?.firstName} {patient?.lastName}
										</p>
										<p className="text-sm text-gray-400">{formatDate(p.appointment?.scheduledAt ?? p.createdAt)}</p>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
											{p.items.length} item{p.items.length !== 1 ? "s" : ""}
										</span>
										<Link to={`/appointments/${p.appointmentId}`} className="text-brand-orange text-xs hover:underline">
											View appointment
										</Link>
									</div>
								</div>

								{p.notes && <p className="text-sm text-gray-600 mt-2 border-t border-gray-100 pt-2">{p.notes}</p>}

								<button
									type="button"
									onClick={() => setExpandedId(isExpanded ? null : p.id)}
									className="text-brand-orange text-xs font-medium hover:underline mt-2 inline-block"
								>
									{isExpanded ? "Hide medications ↑" : "Show medications ↓"}
								</button>

								{isExpanded && (
									<div className="mt-3 border-t border-gray-100 pt-3">
										<table className="w-full text-sm">
											<thead>
												<tr className="text-left text-xs text-gray-400 border-b border-gray-100">
													<th className="pb-2">Medication</th>
													<th className="pb-2">Dosage</th>
													<th className="pb-2">Frequency</th>
													<th className="pb-2">Duration</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-50">
												{p.items.map((item, idx) => (
													<tr key={item.id ?? idx}>
														<td className="py-2 font-medium text-brand-navy">{item.medicationName}</td>
														<td className="py-2 text-gray-600">{item.dosage}</td>
														<td className="py-2 text-gray-600">{item.frequency}</td>
														<td className="py-2 text-gray-600">{item.duration}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
