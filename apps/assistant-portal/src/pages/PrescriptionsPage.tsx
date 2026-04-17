import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import Select from "react-select";

import api from "../api";

interface SelectOption {
	value: string;
	label: string;
}

interface PrescriptionData {
	id: string;
	appointmentId: string;
	notes?: string | null;
	createdAt: string;
	items: Array<{
		id: string;
		medicationName: string;
		dosage: string;
		frequency: string;
		duration: string;
		instructions?: string | null;
	}>;
	patient?: { user?: { firstName: string; lastName: string; email: string } };
	doctor?: { user?: { firstName: string; lastName: string } };
	appointment?: { scheduledAt: string; status: string };
}

export default function PrescriptionsPage(): React.ReactElement {
	const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchType, setSearchType] = useState<"patient" | "doctor">("patient");
	const [patients, setPatients] = useState<SelectOption[]>([]);
	const [doctors, setDoctors] = useState<SelectOption[]>([]);
	const [selectedId, setSelectedId] = useState<SelectOption | null>(null);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const fetchPrescriptions = (endpoint: string): void => {
		setLoading(true);
		void api
			.get<{ data: PrescriptionData[] }>(endpoint)
			.then(r => setPrescriptions(r.data.data))
			.catch(() => setPrescriptions([]))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchPrescriptions("/prescriptions");
		void api
			.get<{ data: Array<{ id: string; user: { firstName: string; lastName: string; email: string } }> }>("/patients")
			.then(r =>
				setPatients(
					r.data.data.map(p => ({ value: p.id, label: `${p.user.firstName} ${p.user.lastName} (${p.user.email})` }))
				)
			);
		void api
			.get<{ data: Array<{ id: string; user: { firstName: string; lastName: string } }> }>("/patients/doctors")
			.then(r =>
				setDoctors(r.data.data.map(d => ({ value: d.id, label: `Dr. ${d.user.firstName} ${d.user.lastName}` })))
			);
	}, []);

	const handleSelect = (option: SelectOption | null): void => {
		setSelectedId(option);
		if (!option) {
			fetchPrescriptions("/prescriptions");
			return;
		}
		const endpoint = searchType === "patient" ? `/prescriptions/patient/${option.value}` : `/prescriptions/doctor/${option.value}`;
		fetchPrescriptions(endpoint);
	};

	const handleTypeChange = (type: "patient" | "doctor"): void => {
		setSearchType(type);
		setSelectedId(null);
		fetchPrescriptions("/prescriptions");
	};

	const toggleExpand = (id: string): void => {
		setExpandedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-4">Prescriptions</h1>

			<div className="card mb-4">
				<div className="flex gap-2 mb-4">
					<button
						type="button"
						className={searchType === "patient" ? "btn-primary text-sm" : "btn-outline text-sm"}
						onClick={() => handleTypeChange("patient")}
					>
						By Patient
					</button>
					<button
						type="button"
						className={searchType === "doctor" ? "btn-primary text-sm" : "btn-outline text-sm"}
						onClick={() => handleTypeChange("doctor")}
					>
						By Doctor
					</button>
				</div>
				<Select
					isClearable
					isSearchable
					placeholder={`Select a ${searchType}...`}
					value={selectedId}
					onChange={handleSelect}
					options={searchType === "patient" ? patients : doctors}
					classNamePrefix="react-select"
				/>
			</div>

			<div className="card">
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && prescriptions.length === 0 && <p className="text-gray-400 text-sm">No prescriptions found.</p>}
				{!loading && prescriptions.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[600px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th className="w-10 px-3 py-2"></th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Patient</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Doctor</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Date</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-28">Medications</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{prescriptions.map(r => {
									const expanded = expandedIds.has(r.id);
									return (
										<React.Fragment key={r.id}>
											<tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(r.id)}>
												<td className="px-3 py-2 text-gray-400">
													{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
												</td>
												<td className="px-3 py-2 font-medium text-brand-navy">
													{r.patient?.user ? `${r.patient.user.firstName} ${r.patient.user.lastName}` : "—"}
												</td>
												<td className="px-3 py-2 text-gray-600">
													{r.doctor?.user ? `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName}` : "—"}
												</td>
												<td className="px-3 py-2 text-gray-500">
													{new Date(r.appointment?.scheduledAt ?? r.createdAt).toLocaleDateString("en-NL", {
														year: "numeric",
														month: "short",
														day: "numeric",
													})}
												</td>
												<td className="px-3 py-2 text-gray-500">{r.items.length}</td>
											</tr>
											{expanded && (
												<tr>
													<td colSpan={5} className="bg-gray-50 px-6 py-3">
														{r.notes && <p className="text-gray-500 text-xs mb-3">{r.notes}</p>}
														<table className="w-full text-xs">
															<thead>
																<tr className="border-b border-gray-200">
																	<th className="text-left px-2 py-1 font-semibold text-gray-500">Medication</th>
																	<th className="text-left px-2 py-1 font-semibold text-gray-500">Dosage</th>
																	<th className="text-left px-2 py-1 font-semibold text-gray-500">Frequency</th>
																	<th className="text-left px-2 py-1 font-semibold text-gray-500">Duration</th>
																	<th className="text-left px-2 py-1 font-semibold text-gray-500">Instructions</th>
																</tr>
															</thead>
															<tbody className="divide-y divide-gray-100">
																{r.items.map(item => (
																	<tr key={item.id}>
																		<td className="px-2 py-1">{item.medicationName}</td>
																		<td className="px-2 py-1">{item.dosage}</td>
																		<td className="px-2 py-1">{item.frequency}</td>
																		<td className="px-2 py-1">{item.duration}</td>
																		<td className="px-2 py-1 text-gray-400">{item.instructions ?? "—"}</td>
																	</tr>
																))}
															</tbody>
														</table>
													</td>
												</tr>
											)}
										</React.Fragment>
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
