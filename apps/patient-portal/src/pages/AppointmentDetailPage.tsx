import type { Appointment, Review } from "@clinic/shared-types";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import api from "../api";
import RescheduleModal from "../components/RescheduleModal";
import { formatDate, formatTime, isSameUTCDay } from "../utils/formatDate";

function extractErrorMessage(err: unknown, fallback: string): string {
	return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

const STATUS_STYLES: Record<string, string> = {
	SCHEDULED: "bg-blue-100 text-blue-800",
	CONFIRMED: "bg-green-100 text-green-800",
	CANCELLED: "bg-red-100 text-red-800",
	COMPLETED: "bg-gray-100 text-gray-600",
};

const ACTIONABLE = ["SCHEDULED", "CONFIRMED"];

export default function AppointmentDetailPage(): React.ReactElement {
	const { id } = useParams<{ id: string }>();
	const [appointment, setAppointment] = useState<Appointment | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [cancelling, setCancelling] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [showRescheduleModal, setShowRescheduleModal] = useState(false);
	const [rescheduleSuccess, setRescheduleSuccess] = useState(false);
	const [review, setReview] = useState<Review | null>(null);
	const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
	const [reviewSubmitting, setReviewSubmitting] = useState(false);
	const [reviewError, setReviewError] = useState("");
	const [reviewSuccess, setReviewSuccess] = useState(false);

	const fetchAppointment = useCallback(() => {
		setLoading(true);
		void api
			.get<{ data: Appointment }>(`/appointments/${id}`)
			.then(r => setAppointment(r.data.data))
			.catch(() => setError("Could not load appointment."))
			.finally(() => setLoading(false));
	}, [id]);

	useEffect(() => {
		fetchAppointment();
		// Try to load existing review
		void api
			.get<{ data: Review | null }>(`/appointments/${id}/reviews`)
			.then(r => {
				if (r.data.data) setReview(r.data.data);
			})
			.catch(() => {});
	}, [fetchAppointment]);

	const handleSubmitReview = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setReviewSubmitting(true);
		setReviewError("");
		try {
			const r = await api.post<{ data: Review }>(`/appointments/${id}/reviews`, reviewForm);
			setReview(r.data.data);
			setReviewSuccess(true);
		} catch (err: unknown) {
			setReviewError(extractErrorMessage(err, "Could not submit review."));
		} finally {
			setReviewSubmitting(false);
		}
	};

	const handleCancel = async (): Promise<void> => {
		setCancelling(true);
		setError("");
		try {
			const r = await api.patch<{ data: Appointment }>(`/appointments/${id}/cancel`);
			setAppointment(r.data.data);
			setShowConfirm(false);
		} catch (err: unknown) {
			setError(extractErrorMessage(err, "Could not cancel appointment. Please try again."));
		} finally {
			setCancelling(false);
		}
	};

	const handleRescheduleSuccess = (): void => {
		setShowRescheduleModal(false);
		setRescheduleSuccess(true);
		fetchAppointment();
	};

	if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
	if (!appointment)
		return (
			<div className="text-center py-16">
				<p className="text-red-500 mb-4">{error || "Appointment not found."}</p>
				<Link to="/appointments" className="btn-outline">
					← Back to appointments
				</Link>
			</div>
		);

	const date = new Date(appointment.scheduledAt);
	const doctor = appointment.doctor?.user;
	const isActionable = ACTIONABLE.includes(appointment.status);
	const isToday = isSameUTCDay(date, new Date());

	return (
		<>
			<div className="max-w-2xl mx-auto">
				<Link to="/appointments" className="text-brand-orange hover:underline text-sm font-medium mb-6 inline-block">
					← Back to appointments
				</Link>
				<div className="card">
					<div className="flex items-start justify-between mb-6">
						<h1 className="text-2xl font-bold text-brand-navy">Appointment details</h1>
						<span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[appointment.status]}`}>
							{appointment.status}
						</span>
					</div>

					{rescheduleSuccess && (
						<div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
							Your appointment has been rescheduled successfully.
						</div>
					)}

					<dl className="space-y-4">
						<Row label="Doctor">
							Dr. {doctor?.firstName} {doctor?.lastName}
						</Row>
						<Row label="Specialization">{appointment.doctor?.specialization ?? "—"}</Row>
						<Row label="Date">{formatDate(date)}</Row>
						<Row label="Time">{formatTime(date)}</Row>
						{appointment.notes && (
							<Row label="Doctor's Notes">
								<span className="whitespace-pre-wrap">{appointment.notes}</span>
							</Row>
						)}
					</dl>

					{error && <p className="text-red-500 text-sm mt-4">{error}</p>}

					<ActionSection
						isActionable={isActionable}
						isToday={isToday}
						showConfirm={showConfirm}
						cancelling={cancelling}
						onRequestCancel={() => {
							setShowConfirm(true);
							setError("");
						}}
						onConfirmCancel={() => {
							void handleCancel();
						}}
						onKeep={() => setShowConfirm(false)}
						onReschedule={() => setShowRescheduleModal(true)}
					/>

					{/* Review Section — only for completed appointments */}
					{appointment.status === "COMPLETED" && (
						<ReviewSection
							review={review}
							reviewSuccess={reviewSuccess}
							reviewForm={reviewForm}
							reviewSubmitting={reviewSubmitting}
							reviewError={reviewError}
							onSubmit={handleSubmitReview}
							onChangeForm={setReviewForm}
						/>
					)}
				</div>
			</div>

			{showRescheduleModal && appointment.doctor && (
				<RescheduleModal
					appointmentId={appointment.id}
					doctorId={appointment.doctorId}
					currentScheduledAt={appointment.scheduledAt}
					onClose={() => setShowRescheduleModal(false)}
					onSuccess={handleRescheduleSuccess}
				/>
			)}
		</>
	);
}

function ReviewSection({
	review,
	reviewSuccess,
	reviewForm,
	reviewSubmitting,
	reviewError,
	onSubmit,
	onChangeForm,
}: {
	review: Review | null;
	reviewSuccess: boolean;
	reviewForm: { rating: number; comment: string };
	reviewSubmitting: boolean;
	reviewError: string;
	onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
	onChangeForm: React.Dispatch<React.SetStateAction<{ rating: number; comment: string }>>;
}): React.ReactElement {
	if (review) {
		return (
			<div className="mt-6 pt-4 border-t border-gray-100">
				<h2 className="text-lg font-semibold text-brand-navy mb-3">Review</h2>
				<div className="bg-gray-50 rounded-lg p-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-yellow-500 text-lg">
							{"★".repeat(review.rating)}
							{"☆".repeat(5 - review.rating)}
						</span>
						<span className="text-sm text-gray-400">{review.rating}/5</span>
					</div>
					{review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
					{reviewSuccess && <p className="text-green-600 text-xs mt-2">Thank you for your review!</p>}
				</div>
			</div>
		);
	}

	return (
		<div className="mt-6 pt-4 border-t border-gray-100">
			<h2 className="text-lg font-semibold text-brand-navy mb-3">Review</h2>
			<form
				onSubmit={e => {
					void onSubmit(e);
				}}
				className="space-y-3"
			>
				<div>
					<label className="block text-sm font-medium text-gray-600 mb-1">Rating</label>
					<div className="flex gap-1">
						{[1, 2, 3, 4, 5].map(star => (
							<button
								key={star}
								type="button"
								onClick={() => onChangeForm(f => ({ ...f, rating: star }))}
								className={`text-2xl ${star <= reviewForm.rating ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition-colors`}
							>
								★
							</button>
						))}
					</div>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="review-comment">
						Comment (optional)
					</label>
					<textarea
						id="review-comment"
						value={reviewForm.comment}
						onChange={e => onChangeForm(f => ({ ...f, comment: e.target.value }))}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
						rows={3}
						placeholder="Share your experience..."
					/>
				</div>
				{reviewError && <p className="text-red-500 text-sm">{reviewError}</p>}
				<button type="submit" disabled={reviewSubmitting} className="btn-primary text-sm px-4 py-2">
					{reviewSubmitting ? "Submitting..." : "Submit review"}
				</button>
			</form>
		</div>
	);
}

function ActionSection({
	isActionable,
	isToday,
	showConfirm,
	cancelling,
	onRequestCancel,
	onConfirmCancel,
	onKeep,
	onReschedule,
}: {
	isActionable: boolean;
	isToday: boolean;
	showConfirm: boolean;
	cancelling: boolean;
	onRequestCancel: () => void;
	onConfirmCancel: () => void;
	onKeep: () => void;
	onReschedule: () => void;
}): React.ReactElement | null {
	if (!isActionable) return null;

	return (
		<div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
			{/* Reschedule button — hidden for same-day appointments */}
			{!showConfirm && !isToday && (
				<button
					onClick={onReschedule}
					className="text-brand-orange border border-brand-orange hover:bg-orange-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
				>
					Reschedule appointment
				</button>
			)}

			{/* Cancel section */}
			{isToday ? (
				<div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
					<span className="text-amber-500 mt-0.5">ℹ</span>
					<p className="text-sm text-amber-800">
						Your appointment is today. If you need to cancel or reschedule, please{" "}
						<strong>call the clinic directly</strong>.
					</p>
				</div>
			) : (
				<>
					{!showConfirm && (
						<button
							onClick={onRequestCancel}
							className="text-red-600 border border-red-300 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-2"
						>
							Cancel appointment
						</button>
					)}
					{showConfirm && (
						<div>
							<p className="text-sm text-gray-600 mb-3">Are you sure you want to cancel this appointment?</p>
							<div className="flex gap-3">
								<button
									onClick={onConfirmCancel}
									disabled={cancelling}
									className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
								>
									{cancelling ? "Cancelling..." : "Yes, cancel it"}
								</button>
								<button onClick={onKeep} disabled={cancelling} className="btn-outline text-sm px-4 py-2">
									Keep appointment
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
	return (
		<div className="flex flex-col sm:flex-row sm:gap-4">
			<dt className="text-sm font-semibold text-gray-500 w-32 shrink-0">{label}</dt>
			<dd className="text-brand-navy font-medium">{children}</dd>
		</div>
	);
}
