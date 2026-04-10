import type { Appointment } from "@clinic/shared-types";
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import api from "../api";

const STATUSES = ["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

function badgeClass(status: string): string {
	const map: Record<string, string> = {
		SCHEDULED: "badge-scheduled",
		CONFIRMED: "badge-confirmed",
		COMPLETED: "badge-completed",
		CANCELLED: "badge-cancelled",
	};
	return map[status] ?? "badge-scheduled";
}

export default function AppointmentsPage(): React.ReactElement {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [status, setStatus] = useState<string>("ALL");
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [sortCol, setSortCol] = useState<"patient" | "date">("date");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

	const load = useCallback(() => {
		setLoading(true);
		const params: Record<string, string> = {};
		if (status !== "ALL") params.status = status;
		void api
			.get<{ data: Appointment[] }>("/appointments", { params })
			.then(r => setAppointments(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [status]);

	useEffect(() => {
		load();
	}, [load]);

	const handleSort = (col: "patient" | "date"): void => {
		if (sortCol === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
		else {
			setSortCol(col);
			setSortDir("asc");
		}
	};

	const sortIndicator = (col: "patient" | "date"): string =>
		sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ↕";

	const filtered = search
		? appointments.filter(a => {
				const name = `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`.toLowerCase();
				return name.includes(search.toLowerCase());
			})
		: appointments;

	const sorted = [...filtered].sort((a, b) => {
		let cmp = 0;
		if (sortCol === "date") {
			cmp = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
		} else {
			cmp = `${a.patient?.user?.lastName ?? ""}`.localeCompare(`${b.patient?.user?.lastName ?? ""}`);
		}
		return sortDir === "asc" ? cmp : -cmp;
	});

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Appointments</h1>

			{/* Status filter tabs */}
			<div className="flex gap-2 mb-6 flex-wrap">
				{STATUSES.map(s => (
					<button
						key={s}
						onClick={() => setStatus(s)}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
							status === s
								? "bg-brand-orange text-white"
								: "bg-white border border-gray-200 text-gray-500 hover:border-brand-orange hover:text-brand-orange"
						}`}
					>
						{s}
					</button>
				))}
			</div>

			<div className="mb-4">
				<input
					type="text"
					placeholder="Search patient..."
					value={search}
					onChange={e => setSearch(e.target.value)}
					className="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange"
				/>
			</div>

			{loading && <p className="text-gray-400">Loading...</p>}

			{!loading && appointments.length === 0 && (
				<div className="card text-center py-12 text-gray-400">No appointments found.</div>
			)}

			{!loading && appointments.length > 0 && (
				<div className="card overflow-hidden p-0">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-100">
							<tr>
								<th
									className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase cursor-pointer select-none hover:text-brand-orange"
									onClick={() => handleSort("patient")}
								>
									Patient{sortIndicator("patient")}
								</th>
								<th
									className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase cursor-pointer select-none hover:text-brand-orange"
									onClick={() => handleSort("date")}
								>
									Date & Time{sortIndicator("date")}
								</th>
								<th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
								<th className="px-4 py-3"></th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50">
							{sorted.map(a => {
								const date = new Date(a.scheduledAt);
								const patient = a.patient?.user;
								return (
									<tr key={a.id} className="hover:bg-gray-50 transition-colors">
										<td className="px-4 py-3 font-medium text-brand-navy">
											{patient?.firstName} {patient?.lastName}
										</td>
										<td className="px-4 py-3 text-gray-500">
											{date.toLocaleDateString("en-NL")}{" "}
											{date.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
										</td>
										<td className="px-4 py-3">
											<span className={badgeClass(a.status)}>{a.status}</span>
										</td>
										<td className="px-4 py-3 text-right">
											<Link
												to={`/appointments/${a.id}`}
												className="text-brand-orange text-xs font-medium hover:underline"
											>
												View →
											</Link>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
