import React, { useEffect, useState } from "react";

interface UnavailabilityBlock {
	id: string;
	startDate: string;
	endDate: string;
	reason?: string | null;
	createdAt: string;
}

import api from "../api";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-NL", { year: "numeric", month: "short", day: "numeric" });
}

export default function AvailabilityPage(): React.ReactElement {
	const [blocks, setBlocks] = useState<UnavailabilityBlock[]>([]);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const fetchBlocks = (): void => {
		void api
			.get<{ data: UnavailabilityBlock[] }>("/availability")
			.then(r => setBlocks(r.data.data))
			.catch(() => setError("Could not load unavailability blocks."))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchBlocks();
	}, []);

	const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			await api.post("/availability", form);
			setSuccess("Time-off block created.");
			setForm({ startDate: "", endDate: "", reason: "" });
			fetchBlocks();
		} catch (err: unknown) {
			const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setError(msg ?? "Could not create block.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: string): Promise<void> => {
		try {
			await api.delete(`/availability/${id}`);
			setBlocks(prev => prev.filter(b => b.id !== id));
		} catch {
			setError("Could not delete block.");
		}
	};

	return (
		<div>
			<h1 className="text-2xl font-bold text-brand-navy mb-6">Manage Availability</h1>

			{/* Add new block */}
			<div className="card mb-8">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Add time off</h2>
				<form
					onSubmit={e => {
						void handleSubmit(e);
					}}
					className="grid sm:grid-cols-4 gap-4 items-end"
				>
					<div>
						<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="startDate">
							Start date
						</label>
						<input
							id="startDate"
							type="datetime-local"
							value={form.startDate}
							onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
							required
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="endDate">
							End date
						</label>
						<input
							id="endDate"
							type="datetime-local"
							value={form.endDate}
							onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
							required
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="reason">
							Reason (optional)
						</label>
						<input
							id="reason"
							type="text"
							value={form.reason}
							onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
							placeholder="e.g. Vacation"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
						/>
					</div>
					<button type="submit" disabled={submitting} className="btn-primary h-10">
						{submitting ? "Adding..." : "Add block"}
					</button>
				</form>
				{error && <p className="text-red-500 text-sm mt-3">{error}</p>}
				{success && <p className="text-green-600 text-sm mt-3">{success}</p>}
			</div>

			{/* Existing blocks */}
			<div className="card">
				<h2 className="text-lg font-semibold text-brand-navy mb-4">Scheduled time off</h2>
				{loading && <p className="text-gray-400 text-sm">Loading...</p>}
				{!loading && blocks.length === 0 && <p className="text-gray-400 text-sm">No time-off blocks scheduled.</p>}
				{!loading && blocks.length > 0 && (
					<div className="divide-y divide-gray-100">
						{blocks.map(block => (
							<div key={block.id} className="flex items-center justify-between py-3">
								<div>
									<p className="text-sm font-medium text-brand-navy">
										{formatDate(block.startDate)} — {formatDate(block.endDate)}
									</p>
									{block.reason && <p className="text-xs text-gray-400">{block.reason}</p>}
								</div>
								<button
									onClick={() => {
										void handleDelete(block.id);
									}}
									className="text-red-500 text-xs hover:underline"
								>
									Delete
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
