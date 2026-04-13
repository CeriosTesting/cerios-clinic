import { useRoute, type RouteProp } from "@react-navigation/native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

import {
	useAppointmentDetail,
	useAppointmentReview,
	useCancelAppointment,
	usePrescriptions,
	useSubmitReview,
} from "../api/hooks";
import RescheduleModal from "../components/RescheduleModal";
import { StatusBadge } from "../components/StatusBadge";
import type { AppointmentsStackParamList } from "../navigation/AppNavigator";
import { formatDate, formatTime, isSameDay } from "../utils/dateUtils";

type Route = RouteProp<AppointmentsStackParamList, "AppointmentDetail">;

const ACTIONABLE = ["SCHEDULED", "CONFIRMED"] as const;

export default function AppointmentDetailScreen(): React.JSX.Element {
	const { params } = useRoute<Route>();
	const { data: apt, isLoading, error, refetch } = useAppointmentDetail(params.id);
	const cancel = useCancelAppointment();
	const [showReschedule, setShowReschedule] = useState(false);

	// Review
	const { data: existingReview } = useAppointmentReview(params.id);
	const submitReview = useSubmitReview();
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewComment, setReviewComment] = useState("");

	// Prescription
	const { data: prescriptions } = usePrescriptions();
	const prescription = prescriptions?.find(p => p.appointmentId === params.id);

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color="#1A2238" />
			</View>
		);
	}

	if (error || !apt) {
		return (
			<View style={styles.center}>
				<Text style={styles.errorText}>Could not load appointment.</Text>
			</View>
		);
	}

	const doctor = apt.doctor?.user;
	const isActionable = (ACTIONABLE as readonly string[]).includes(apt.status);
	const isToday = isSameDay(apt.scheduledAt, new Date().toISOString());
	const isCompleted = apt.status === "COMPLETED";

	const handleCancelConfirm = (): void => {
		cancel.mutate(apt.id, {
			onError: (err: unknown) => {
				const msg =
					(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
					"Could not cancel. Please try again.";
				Alert.alert("Error", msg);
			},
		});
	};

	const handleCancel = (): void => {
		Alert.alert("Cancel appointment", "Are you sure you want to cancel this appointment?", [
			{ text: "Keep it", style: "cancel" },
			{
				text: "Cancel appointment",
				style: "destructive",
				onPress: handleCancelConfirm,
			},
		]);
	};

	const handleSubmitReview = (): void => {
		if (reviewRating < 1) {
			Alert.alert("Rating required", "Please select at least 1 star.");
			return;
		}
		submitReview.mutate(
			{ appointmentId: apt.id, dto: { rating: reviewRating, comment: reviewComment || undefined } },
			{
				onSuccess: () => Alert.alert("Thank you!", "Your review has been submitted."),
				onError: (err: unknown) => {
					const msg =
						(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
						"Could not submit review.";
					Alert.alert("Error", msg);
				},
			}
		);
	};

	return (
		<>
			<ScrollView style={styles.container} contentContainerStyle={styles.content}>
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Text style={styles.title}>Appointment details</Text>
						<StatusBadge status={apt.status} />
					</View>

					<Row label="Doctor">
						Dr. {doctor?.firstName} {doctor?.lastName}
					</Row>
					<Row label="Specialization">{apt.doctor?.specialization ?? "—"}</Row>
					<Row label="Date">{formatDate(apt.scheduledAt)}</Row>
					<Row label="Time">{formatTime(apt.scheduledAt)}</Row>
					{apt.notes ? <Row label="Doctor's Notes">{apt.notes}</Row> : null}
				</View>

				{/* Prescription section */}
				{isCompleted && prescription && (
					<View style={styles.card}>
						<Text style={styles.title}>Prescription</Text>
						{prescription.notes ? <Text style={styles.prescriptionNotes}>{prescription.notes}</Text> : null}
						{prescription.items.map(item => (
							<View key={item.id} style={styles.medItem}>
								<Text style={styles.medName}>{item.medicationName}</Text>
								<Text style={styles.medDetail}>
									{item.dosage} · {item.frequency} · {item.duration}
								</Text>
								{item.instructions ? <Text style={styles.medInstructions}>{item.instructions}</Text> : null}
							</View>
						))}
					</View>
				)}

				{/* Review section */}
				{isCompleted && (
					<View style={styles.card}>
						<Text style={styles.title}>Review</Text>
						{existingReview ? (
							<>
								<View style={styles.starRow}>
									{[1, 2, 3, 4, 5].map(s => (
										<Text key={s} style={styles.starDisplay}>
											{s <= existingReview.rating ? "★" : "☆"}
										</Text>
									))}
								</View>
								{existingReview.comment ? <Text style={styles.reviewComment}>{existingReview.comment}</Text> : null}
							</>
						) : (
							<>
								<Text style={styles.reviewPrompt}>How was your experience?</Text>
								<View style={styles.starRow}>
									{[1, 2, 3, 4, 5].map(s => (
										<TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
											<Text style={[styles.starInput, s <= reviewRating && styles.starActive]}>
												{s <= reviewRating ? "★" : "☆"}
											</Text>
										</TouchableOpacity>
									))}
								</View>
								<TextInput
									style={styles.reviewInput}
									placeholder="Leave a comment (optional)"
									placeholderTextColor="#9CA3AF"
									value={reviewComment}
									onChangeText={setReviewComment}
									multiline
									numberOfLines={3}
								/>
								<TouchableOpacity
									style={[styles.btnPrimary, submitReview.isPending && styles.btnDisabled]}
									onPress={handleSubmitReview}
									disabled={submitReview.isPending}
								>
									{submitReview.isPending ? (
										<ActivityIndicator color="#fff" />
									) : (
										<Text style={styles.btnPrimaryText}>Submit Review</Text>
									)}
								</TouchableOpacity>
							</>
						)}
					</View>
				)}

				{isActionable && (
					<ActionButtons
						isPending={cancel.isPending}
						isToday={isToday}
						onReschedule={(): void => setShowReschedule(true)}
						onCancel={handleCancel}
					/>
				)}
			</ScrollView>

			{showReschedule ? (
				<RescheduleModal
					appointmentId={apt.id}
					doctorId={apt.doctorId}
					currentScheduledAt={apt.scheduledAt}
					onClose={(): void => setShowReschedule(false)}
					onSuccess={(): void => {
						setShowReschedule(false);
						void refetch();
					}}
				/>
			) : null}
		</>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue}>{children}</Text>
		</View>
	);
}

interface ActionButtonsProps {
	isPending: boolean;
	isToday: boolean;
	onReschedule: () => void;
	onCancel: () => void;
}

function ActionButtons({ isPending, isToday, onReschedule, onCancel }: ActionButtonsProps): React.JSX.Element {
	return (
		<View style={styles.actions}>
			{!isToday && (
				<TouchableOpacity style={styles.btnOutline} onPress={onReschedule}>
					<Text style={styles.btnOutlineText}>Reschedule</Text>
				</TouchableOpacity>
			)}
			<TouchableOpacity
				style={[styles.btnDanger, isPending && styles.btnDisabled]}
				onPress={onCancel}
				disabled={isPending}
			>
				{isPending ? (
					<ActivityIndicator color="#ffffff" />
				) : (
					<Text style={styles.btnDangerText}>Cancel Appointment</Text>
				)}
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	content: { padding: 20 },
	center: { flex: 1, justifyContent: "center", alignItems: "center" },
	errorText: { color: "#EF4444", fontSize: 15 },
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	title: { fontSize: 18, fontWeight: "700", color: "#1A2238" },
	row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
	rowLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
	rowValue: { fontSize: 15, color: "#111827" },
	actions: { gap: 10 },
	btnOutline: {
		borderWidth: 1.5,
		borderColor: "#1A2238",
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center",
	},
	btnOutlineText: { color: "#1A2238", fontWeight: "600", fontSize: 15 },
	btnDanger: {
		backgroundColor: "#EF4444",
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center",
	},
	btnDangerText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
	btnDisabled: { opacity: 0.6 },
	// Prescription styles
	prescriptionNotes: { fontSize: 13, color: "#6B7280", fontStyle: "italic", marginTop: 8 },
	medItem: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10 },
	medName: { fontSize: 14, fontWeight: "600", color: "#1A2238" },
	medDetail: { fontSize: 12, color: "#6B7280", marginTop: 2 },
	medInstructions: { fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" },
	// Review styles
	reviewPrompt: { fontSize: 14, color: "#6B7280", marginTop: 8 },
	starRow: { flexDirection: "row", gap: 4, marginTop: 8 },
	starDisplay: { fontSize: 22, color: "#F59E0B" },
	starInput: { fontSize: 28, color: "#D1D5DB" },
	starActive: { color: "#F59E0B" },
	reviewComment: { fontSize: 14, color: "#374151", marginTop: 8 },
	reviewInput: {
		marginTop: 12,
		backgroundColor: "#F9FAFB",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		padding: 12,
		fontSize: 14,
		color: "#1A2238",
		textAlignVertical: "top" as const,
		minHeight: 80,
	},
	btnPrimary: {
		backgroundColor: "#E85A28",
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center" as const,
		marginTop: 12,
	},
	btnPrimaryText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
});
