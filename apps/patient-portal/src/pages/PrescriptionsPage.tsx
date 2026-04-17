import type { Prescription } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";

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
		<div className="max-w-3xl mx-auto">
			<h1 className="text-2xl font-bold text-brand-navy mb-6">My Prescriptions</h1>

			{loading && <p className="text-gray-400">Loading...</p>}
			{error && <p className="text-red-500">{error}</p>}

			{!loading && !error && prescriptions.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400">No prescriptions yet.</p>
				</div>
			)}

			{!loading && prescriptions.length > 0 && (
				<div className="space-y-4">
					{prescriptions.map(p => {
						const doctor = p.doctor?.user;
						const isExpanded = expandedId === p.id;
						return (
							<div key={p.id} className="card">
								<div className="flex items-start justify-between mb-2">
									<div>
										<p className="font-semibold text-brand-navy">
											Dr. {doctor?.firstName} {doctor?.lastName}
										</p>
										<p className="text-sm text-gray-400">{formatDate(p.appointment?.scheduledAt ?? p.createdAt)}</p>
									</div>
									<span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
										{p.items.length} medication{p.items.length !== 1 ? "s" : ""}
									</span>
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
									<div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
										{p.items.map((item, idx) => (
											<div key={item.id ?? idx} className="bg-gray-50 rounded-lg p-3">
												<p className="font-medium text-brand-navy text-sm">{item.medicationName}</p>
												<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
													<span>Dosage: {item.dosage}</span>
													<span>Frequency: {item.frequency}</span>
													<span>Duration: {item.duration}</span>
												</div>
												{item.instructions && <p className="text-xs text-gray-400 mt-1 italic">{item.instructions}</p>}
											</div>
										))}
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
