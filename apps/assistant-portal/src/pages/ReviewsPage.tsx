import { Star } from "lucide-react";
import React, { useEffect, useState } from "react";
import Select from "react-select";

import api from "../api";

interface SelectOption {
	value: string;
	label: string;
}

interface ReviewData {
	id: string;
	rating: number;
	comment?: string | null;
	createdAt: string;
	patient?: { user?: { firstName: string; lastName: string } };
	doctor?: { user?: { firstName: string; lastName: string } };
	appointment?: { scheduledAt: string };
}

interface ReviewStats {
	averageRating: number;
	totalReviews: number;
}

function Stars({ value, max = 5 }: { value: number; max?: number }): React.ReactElement {
	return (
		<span className="inline-flex gap-0.5">
			{Array.from({ length: max }, (_, i) => (
				<Star key={i} size={14} className={i < value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
			))}
		</span>
	);
}

export default function ReviewsPage(): React.ReactElement {
	const [reviews, setReviews] = useState<ReviewData[]>([]);
	const [stats, setStats] = useState<ReviewStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [searchType, setSearchType] = useState<"doctor" | "patient">("doctor");
	const [patients, setPatients] = useState<SelectOption[]>([]);
	const [doctors, setDoctors] = useState<SelectOption[]>([]);
	const [selectedId, setSelectedId] = useState<SelectOption | null>(null);

	const fetchReviews = (endpoint: string): void => {
		setLoading(true);
		void api
			.get<{ data: ReviewData[]; stats?: ReviewStats }>(endpoint)
			.then(r => {
				setReviews(r.data.data);
				setStats(r.data.stats ?? null);
			})
			.catch(() => {
				setReviews([]);
				setStats(null);
			})
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchReviews("/reviews");
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
			fetchReviews("/reviews");
			return;
		}
		const endpoint = `/reviews/${searchType}/${option.value}`;
		fetchReviews(endpoint);
	};

	const handleTypeChange = (type: "doctor" | "patient"): void => {
		setSearchType(type);
		setSelectedId(null);
		fetchReviews("/reviews");
	};

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-4">Reviews</h1>

			<div className="card mb-4">
				<div className="flex gap-2 mb-4">
					<button
						type="button"
						className={searchType === "doctor" ? "btn-primary text-sm" : "btn-outline text-sm"}
						onClick={() => handleTypeChange("doctor")}
					>
						By Doctor
					</button>
					<button
						type="button"
						className={searchType === "patient" ? "btn-primary text-sm" : "btn-outline text-sm"}
						onClick={() => handleTypeChange("patient")}
					>
						By Patient
					</button>
				</div>
				<Select
					isClearable
					isSearchable
					placeholder={`Select a ${searchType}...`}
					value={selectedId}
					onChange={handleSelect}
					options={searchType === "doctor" ? doctors : patients}
					classNamePrefix="react-select"
				/>
			</div>

			{stats && (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<div className="card text-center">
						<p className="text-3xl font-bold text-brand-navy">
							{stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
						</p>
						<p className="text-xs text-gray-400 mt-1">Average rating</p>
						{stats.averageRating > 0 && (
							<div className="mt-1 flex justify-center">
								<Stars value={Math.round(stats.averageRating)} />
							</div>
						)}
					</div>
					<div className="card text-center">
						<p className="text-3xl font-bold text-brand-navy">{stats.totalReviews}</p>
						<p className="text-xs text-gray-400 mt-1">Total reviews</p>
					</div>
				</div>
			)}

			<div className="card">
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && reviews.length === 0 && <p className="text-gray-400 text-sm">No reviews found.</p>}
				{!loading && reviews.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[500px]">
							<thead className="border-b border-gray-100">
								<tr>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Patient</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-32">Rating</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Comment</th>
									<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase w-28">Date</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{reviews.map(r => (
									<tr key={r.id} className="hover:bg-gray-50 transition-colors">
										<td className="px-3 py-2 font-medium text-brand-navy">
											{r.patient?.user ? `${r.patient.user.firstName} ${r.patient.user.lastName}` : "—"}
										</td>
										<td className="px-3 py-2">
											<Stars value={r.rating} />
										</td>
										<td className="px-3 py-2 text-gray-600">{r.comment ?? <span className="text-gray-300">—</span>}</td>
										<td className="px-3 py-2 text-gray-500">
											{new Date(r.appointment?.scheduledAt ?? r.createdAt).toLocaleDateString("en-NL", {
												year: "numeric",
												month: "short",
												day: "numeric",
											})}
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
