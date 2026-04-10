import type { DoctorPublic } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";

import api from "../api";

export default function DoctorsPage(): React.ReactElement {
	const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		void api
			.get<{ data: DoctorPublic[] }>("/doctors")
			.then(r => setDoctors(r.data.data))
			.catch(() => setError("Could not load doctors list."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="max-w-3xl mx-auto">
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Our Doctors</h1>

			{loading && <p className="text-gray-400">Loading...</p>}
			{error && <p className="text-red-500">{error}</p>}

			{!loading && !error && doctors.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400">No doctors available at the moment.</p>
				</div>
			)}

			{!loading && doctors.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2">
					{doctors.map(d => (
						<div key={d.id} className="card">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-brand-navy rounded-full flex items-center justify-center shrink-0">
									<span className="text-brand-orange font-bold text-sm">
										{d.firstName[0]}
										{d.lastName[0]}
									</span>
								</div>
								<div>
									<p className="font-semibold text-brand-navy">
										Dr. {d.firstName} {d.lastName}
									</p>
									<p className="text-sm text-gray-400">{d.specialization ?? "General Practice"}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
