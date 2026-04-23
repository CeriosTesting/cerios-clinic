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

const STATUSES = ["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

type SortColumn = "patient" | "date";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 50;

export default function AppointmentsPage(): React.ReactElement {
	const navigate = useNavigate();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(0);
	const [loading, setLoading] = useState(true);
	const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [sortCol, setSortCol] = useState<SortColumn>("date");
	const [sortDir, setSortDir] = useState<SortDirection>("asc");
	const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return (): void => clearTimeout(t);
	}, [search]);

	const load = useCallback(
		(pageIndex: number, searchTerm: string, statusFilter: string, col: SortColumn, dir: SortDirection) => {
			setLoading(true);
			const params: Record<string, string | number> = {
				limit: PAGE_SIZE,
				offset: pageIndex * PAGE_SIZE,
				sortBy: col,
				sortOrder: dir,
			};
			if (searchTerm) params.search = searchTerm;
			if (statusFilter !== "ALL") params.status = statusFilter;
			void api
				.get<{ data: Appointment[]; total: number }>("/appointments", { params })
				.then(r => {
					setAppointments(r.data.data);
					setTotal(r.data.total);
				})
				.catch(() => {})
				.finally(() => setLoading(false));
		},
		[]
	);

	useEffect(() => {
		load(page, debouncedSearch, status, sortCol, sortDir);
	}, [load, page, debouncedSearch, status, sortCol, sortDir]);

	const handleSort = (col: SortColumn): void => {
		setPage(0);
		if (sortCol === col) {
			setSortDir(d => (d === "asc" ? "desc" : "asc"));
			return;
		}
		setSortCol(col);
		setSortDir("asc");
	};

	const sortIndicator = (col: SortColumn): string => (sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ↕");

	const handleCancel = async (id: string): Promise<void> => {
		await api.delete(`/appointments/${id}`);
		setCancelConfirm(null);
		load(page, debouncedSearch, status, sortCol, sortDir);
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
				<div className="flex gap-2 mb-4 flex-wrap">
					{STATUSES.map(s => (
						<button
							key={s}
							onClick={() => {
								setStatus(s);
								setPage(0);
							}}
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
				<input
					type="text"
					placeholder="Search patient or doctor"
					className="form-input max-w-xs"
					value={search}
					onChange={e => {
						setSearch(e.target.value);
						setPage(0);
					}}
				/>
			</div>

			<div className="card">
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && appointments.length === 0 && <p className="text-gray-400 text-sm">No appointments found.</p>}
				{!loading && appointments.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[700px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th
										className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase cursor-pointer select-none hover:text-brand-orange"
										onClick={() => handleSort("date")}
									>
										Date & Time{sortIndicator("date")}
									</th>
									<th
										className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase cursor-pointer select-none hover:text-brand-orange"
										onClick={() => handleSort("patient")}
									>
										Patient{sortIndicator("patient")}
									</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Doctor</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-28">Status</th>
									<th className="px-3 py-2 w-36"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{appointments.map(a => {
									const d = new Date(a.scheduledAt);
									return (
										<tr key={a.id} className="hover:bg-gray-50 transition-colors">
											<td className="px-3 py-2 text-gray-600">
												{d.toLocaleDateString("en-NL")}{" "}
												{d.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}
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
															<button className="btn-link-danger" onClick={() => setCancelConfirm(a.id)}>
																Cancel
															</button>
															{cancelConfirm === a.id && (
																<div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-[180px]">
																	<p className="text-sm text-gray-600 mb-2">Cancel this appointment?</p>
																	<div className="flex gap-2 justify-end">
																		<button className="btn-ghost text-xs" onClick={() => setCancelConfirm(null)}>
																			No
																		</button>
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
				{!loading && total > PAGE_SIZE && (
					<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
						<p className="text-xs text-gray-500">
							Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
						</p>
						<div className="flex gap-2">
							<button
								className="btn-ghost text-xs"
								disabled={page === 0}
								onClick={() => setPage(p => Math.max(0, p - 1))}
							>
								Previous
							</button>
							<button
								className="btn-ghost text-xs"
								disabled={(page + 1) * PAGE_SIZE >= total}
								onClick={() => setPage(p => p + 1)}
							>
								Next
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
