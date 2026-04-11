import { useRoute, type RouteProp } from "@react-navigation/native";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAppointmentDetail, useCancelAppointment } from "../api/hooks";
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
});
