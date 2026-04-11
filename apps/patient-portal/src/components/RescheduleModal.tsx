import React, { useCallback, useEffect, useState } from "react";

import api from "../api";
import {
	addUTCDay,
	formatDate,
	formatTime,
	isSameUTCDay,
	isUTCWeekday,
	nextUTCWeekday,
	toUTCDateString,
	tomorrowUTC,
} from "../utils/formatDate";

/** Local shape matching DoctorSlotAvailability from shared-types */
interface SlotAvailability {
	date: string;
	slots: string[];
}

interface Props {
	appointmentId: string;
	doctorId: string;
	currentScheduledAt: string;
	onClose: () => void;
	onSuccess: () => void;
}

export default function RescheduleModal({
	appointmentId,
	doctorId,
	currentScheduledAt,
	onClose,
	onSuccess,
}: Props): React.ReactElement {
	const tomorrow = tomorrowUTC();
	// Ensure selectedDate starts on a weekday
	const initialDate = isUTCWeekday(tomorrow) ? tomorrow : nextUTCWeekday(tomorrow);

	const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
	const [availability, setAvailability] = useState<SlotAvailability | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [slotsError, setSlotsError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");

	const fetchSlots = useCallback(
		async (date: Date) => {
			setLoadingSlots(true);
			setSlotsError("");
			setAvailability(null);
			setSelectedSlot(null);
			try {
				const dateStr = toUTCDateString(date);
				const res = await api.get<{ data: SlotAvailability[] }>(
					`/doctors/${doctorId}/slots?from=${dateStr}&to=${dateStr}`
				);
				setAvailability(res.data.data[0] ?? { date: dateStr, slots: [] });
			} catch {
				setSlotsError("Could not load available slots. Please try again.");
			} finally {
				setLoadingSlots(false);
			}
		},
		[doctorId]
	);

	useEffect(() => {
		void fetchSlots(selectedDate);
	}, [selectedDate, fetchSlots]);

	const goToPrevDay = (): void => {
		const candidate = addUTCDay(selectedDate, -1);
		// Step backwards over weekends, but not before tomorrow
		let prev = candidate;
		while (prev.getTime() >= tomorrow.getTime() && !isUTCWeekday(prev)) {
			prev = addUTCDay(prev, -1);
		}
		if (prev.getTime() >= tomorrow.getTime() && isUTCWeekday(prev)) {
			setSelectedDate(prev);
		}
	};

	const goToNextDay = (): void => {
		const candidate = addUTCDay(selectedDate, 1);
		let next = candidate;
		while (!isUTCWeekday(next)) {
			next = addUTCDay(next, 1);
		}
		setSelectedDate(next);
	};

	const canGoPrev = (): boolean => {
		// Allow going back only if there's a valid weekday before selectedDate that is ≥ tomorrow
		let candidate = addUTCDay(selectedDate, -1);
		while (!isUTCWeekday(candidate) && candidate.getTime() >= tomorrow.getTime()) {
			candidate = addUTCDay(candidate, -1);
		}
		return isUTCWeekday(candidate) && candidate.getTime() >= tomorrow.getTime();
	};

	const handleConfirm = async (): Promise<void> => {
		if (!selectedSlot) return;
		setSubmitting(true);
		setSubmitError("");
		try {
			await api.patch(`/appointments/${appointmentId}/reschedule`, { scheduledAt: selectedSlot });
			onSuccess();
		} catch (err: unknown) {
			const status = (err as { response?: { status?: number } })?.response?.status;
			if (status === 409) {
				setSubmitError("This slot was just taken by another patient. Please choose a different time.");
				// Refresh slots to show updated availability
				void fetchSlots(selectedDate);
			} else {
				setSubmitError("Could not reschedule your appointment. Please try again.");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const currentSlot = new Date(currentScheduledAt);
	const isCurrentSlot = (slot: string): boolean =>
		isSameUTCDay(new Date(slot), currentSlot) && new Date(slot).toISOString() === currentSlot.toISOString();

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
		>
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
				{/* Header */}
				<div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
					<h2 className="text-xl font-bold text-brand-navy">Reschedule appointment</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
						aria-label="Close"
					>
						×
					</button>
				</div>

				{/* Date navigation */}
				<div className="flex items-center justify-between px-6 py-4">
					<button
						onClick={goToPrevDay}
						disabled={!canGoPrev()}
						className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						aria-label="Previous day"
					>
						‹
					</button>
					<div className="text-center">
						<p className="font-semibold text-brand-navy text-sm">{formatDate(selectedDate, { weekday: "long" })}</p>
						<p className="text-xs text-gray-400 mt-0.5">
							{formatDate(selectedDate, { day: "numeric", month: "long", year: "numeric" })}
						</p>
					</div>
					<button
						onClick={goToNextDay}
						className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
						aria-label="Next day"
					>
						›
					</button>
				</div>

				{/* Slot grid */}
				<div className="px-6 pb-4 min-h-[160px]">
					{loadingSlots && <p className="text-center text-gray-400 text-sm py-8">Loading available slots…</p>}
					{slotsError && <p className="text-center text-red-500 text-sm py-4">{slotsError}</p>}
					{!loadingSlots && !slotsError && availability && (
						<>
							{availability.slots.length === 0 ? (
								<p className="text-center text-gray-400 text-sm py-8">No available slots on this day.</p>
							) : (
								<div className="grid grid-cols-4 gap-2">
									{availability.slots.map(slot => {
										const isSelected = selectedSlot === slot;
										const isCurrent = isCurrentSlot(slot);
										return (
											<button
												key={slot}
												onClick={() => setSelectedSlot(isSelected ? null : slot)}
												className={[
													"py-2 px-1 rounded-lg text-sm font-medium border transition-colors",
													isSelected
														? "bg-brand-orange text-white border-brand-orange"
														: isCurrent
															? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
															: "bg-white text-brand-navy border-gray-200 hover:bg-gray-50",
												].join(" ")}
												title={isCurrent ? "Current appointment time" : undefined}
											>
												{formatTime(new Date(slot))}
											</button>
										);
									})}
								</div>
							)}
						</>
					)}
				</div>

				{/* Error message */}
				{submitError && <p className="px-6 pb-3 text-sm text-red-500">{submitError}</p>}

				{/* Footer */}
				<div className="flex gap-3 px-6 pb-5 border-t border-gray-100 pt-4">
					<button
						onClick={() => {
							void handleConfirm();
						}}
						disabled={!selectedSlot || submitting}
						className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{submitting ? "Rescheduling…" : "Confirm new time"}
					</button>
					<button onClick={onClose} disabled={submitting} className="btn-outline py-2.5 px-4 text-sm">
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
