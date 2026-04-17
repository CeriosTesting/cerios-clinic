import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

interface PatientRow {
	id: string;
	userId: string;
	photo?: string | null;
	phone?: string | null;
	dateOfBirth?: string | null;
	user: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
	};
}

export default function PatientsPage(): React.ReactElement {
	const navigate = useNavigate();
	const [patients, setPatients] = useState<PatientRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");

	const search = useCallback((q: string) => {
		setQuery(q);
		setLoading(true);
		void api
			.get<{ data: PatientRow[] }>("/patients", { params: q ? { q } : undefined })
			.then(r => setPatients(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		search("");
	}, [search]);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>): void => {
		e.preventDefault();
		search(query);
	};

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-4">Patients</h1>

			<div className="card">
				<form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-sm">
					<input
						id="patients-search"
						type="text"
						placeholder="Search by name or email"
						className="form-input flex-1"
						value={query}
						onChange={e => setQuery(e.target.value)}
					/>
					<button type="submit" className="btn-primary">
						Search
					</button>
				</form>

				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && patients.length === 0 && <p className="text-gray-400 text-sm">No patients found.</p>}
				{!loading && patients.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[500px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th className="w-14 px-3 py-2"></th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Name</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Email</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Phone</th>
									<th className="px-3 py-2 w-16"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{patients.map(p => (
									<tr
										key={p.id}
										className="hover:bg-gray-50 transition-colors cursor-pointer"
										onClick={() => {
											void navigate(`/patients/${p.userId}`);
										}}
									>
										<td className="px-3 py-2">
											<img
												src={p.photo ?? "/placeholder-avatar.svg"}
												alt=""
												className="w-9 h-12 object-cover rounded border border-gray-200 block"
											/>
										</td>
										<td className="px-3 py-2 font-medium text-brand-navy">
											{p.user.firstName} {p.user.lastName}
										</td>
										<td className="px-3 py-2 text-gray-600">{p.user.email}</td>
										<td className="px-3 py-2 text-gray-500">{p.phone ?? "—"}</td>
										<td className="px-3 py-2">
											<button
												className="btn-link text-brand-accent"
												onClick={e => {
													e.stopPropagation();
													void navigate(`/patients/${p.userId}`);
												}}
											>
												View
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
