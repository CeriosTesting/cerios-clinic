export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

/** Valid status transitions. Terminal states (COMPLETED, CANCELLED) have empty arrays. */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
	SCHEDULED: ["CONFIRMED", "CANCELLED"],
	CONFIRMED: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
};

/**
 * Returns an error message when `from → to` is not an allowed status transition,
 * or `null` when it is allowed. No target status, or the same status, is always allowed.
 */
export function getStatusTransitionError(from: AppointmentStatus, to: AppointmentStatus | undefined): string | null {
	if (!to || to === from) return null;
	const allowed = ALLOWED_TRANSITIONS[from];
	if (allowed.includes(to)) return null;
	return `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`;
}
