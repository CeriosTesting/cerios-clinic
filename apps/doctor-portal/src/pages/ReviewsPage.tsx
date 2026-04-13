import type { Review, DoctorReviewStats } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";

import api from "../api";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-NL", { year: "numeric", month: "short", day: "numeric" });
}

export default function ReviewsPage(): React.ReactElement {
	const [reviews, setReviews] = useState<
		(Review & { patient?: { user?: { firstName: string; lastName: string } }; appointment?: { scheduledAt: string } })[]
	>([]);
	const [stats, setStats] = useState<DoctorReviewStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		void api
			.get<{ data: typeof reviews; stats: DoctorReviewStats }>("/reviews")
			.then(r => {
				setReviews(r.data.data);
				setStats(r.data.stats);
			})
			.catch(() => setError("Could not load reviews."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Patient Reviews</h1>

			{loading && <p className="text-gray-400 text-sm">Loading...</p>}
			{error && <p className="text-red-500 text-sm">{error}</p>}

			{!loading && stats && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
					<div className="card text-center">
						<p className="text-3xl font-bold text-brand-navy">
							{stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
						</p>
						<p className="text-sm text-gray-400 mt-1">Average rating</p>
						{stats.averageRating > 0 && (
							<p className="text-yellow-500 text-lg mt-1">
								{"★".repeat(Math.round(stats.averageRating))}
								{"☆".repeat(5 - Math.round(stats.averageRating))}
							</p>
						)}
					</div>
					<div className="card text-center">
						<p className="text-3xl font-bold text-brand-navy">{stats.totalReviews}</p>
						<p className="text-sm text-gray-400 mt-1">Total reviews</p>
					</div>
				</div>
			)}

			{!loading && !error && reviews.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400">No reviews yet.</p>
				</div>
			)}

			{!loading && reviews.length > 0 && (
				<div className="space-y-4">
					{reviews.map(r => (
						<div key={r.id} className="card">
							<div className="flex items-start justify-between mb-2">
								<div>
									<p className="font-semibold text-brand-navy">
										{r.patient?.user?.firstName} {r.patient?.user?.lastName}
									</p>
									<p className="text-xs text-gray-400">{formatDate(r.appointment?.scheduledAt ?? r.createdAt)}</p>
								</div>
								<span className="text-yellow-500 text-sm">
									{"★".repeat(r.rating)}
									{"☆".repeat(5 - r.rating)}
								</span>
							</div>
							{r.comment && <p className="text-sm text-gray-600 mt-2 border-t border-gray-100 pt-2">{r.comment}</p>}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
