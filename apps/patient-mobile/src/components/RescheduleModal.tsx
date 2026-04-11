import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useDoctorSlots, useRescheduleAppointment } from "../api/hooks";
import { tomorrowDate, nextWeekday, toDateString, isWeekday, formatDate, formatTime } from "../utils/dateUtils";

interface Props {
	appointmentId: string;
	doctorId: string;
	currentScheduledAt: string;
	onClose: () => void;
	onSuccess: () => void;
}

export default function RescheduleModal({ appointmentId, doctorId, onClose, onSuccess }: Props): React.JSX.Element {
	// Stable reference — tomorrowDate() must not be called on every render
	const tomorrow = useMemo(() => tomorrowDate(), []);
	const initial = isWeekday(tomorrow) ? tomorrow : nextWeekday(tomorrow);
	const [selectedDate, setSelectedDate] = useState<Date>(initial);
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [showPicker, setShowPicker] = useState(false);

	const dateStr = toDateString(selectedDate);
	const { data: availability, isLoading: loadingSlots } = useDoctorSlots(doctorId, dateStr);
	const reschedule = useRescheduleAppointment();

	useEffect(() => {
		setSelectedSlot(null);
	}, [dateStr]);

	const handleDateChange = useCallback(
		(_event: DateTimePickerEvent, date?: Date) => {
			setShowPicker(false);
			if (!date) return;
			// Ensure weekday and not before tomorrow
			let chosen = date;
			while (!isWeekday(chosen) || chosen < tomorrow) {
				chosen = new Date(chosen.getTime() + 86_400_000);
			}
			setSelectedDate(chosen);
		},
		[tomorrow]
	);

	const handleConfirm = (): void => {
		if (!selectedSlot) return;
		reschedule.mutate(
			{ id: appointmentId, scheduledAt: selectedSlot },
			{
				onSuccess,
				onError: (err: unknown) => {
					const status = (err as { response?: { status?: number } })?.response?.status;
					const msg =
						status === 409
							? "This slot was just taken. Please pick another time."
							: "Could not reschedule. Please try again.";
					// Alert displayed inside modal
					Alert.alert("Error", msg);
				},
			}
		);
	};

	return (
		<Modal animationType="slide" transparent onRequestClose={onClose}>
			<View style={styles.overlay}>
				<View style={styles.sheet}>
					<View style={styles.header}>
						<Text style={styles.title}>Reschedule Appointment</Text>
						<TouchableOpacity onPress={onClose}>
							<Text style={styles.close}>✕</Text>
						</TouchableOpacity>
					</View>

					{/* Date selector */}
					<TouchableOpacity style={styles.datePicker} onPress={() => setShowPicker(true)}>
						<Text style={styles.dateLabel}>Selected date</Text>
						<Text style={styles.dateValue}>{formatDate(selectedDate.toISOString())}</Text>
					</TouchableOpacity>

					{showPicker && (
						<DateTimePicker value={selectedDate} mode="date" minimumDate={tomorrow} onChange={handleDateChange} />
					)}

					{/* Slot list */}
					<Text style={styles.slotsLabel}>Available times</Text>
					{loadingSlots ? (
						<ActivityIndicator style={styles.loader} color="#1A2238" />
					) : (availability?.slots ?? []).length === 0 ? (
						<Text style={styles.noSlots}>No available slots on this day.</Text>
					) : (
						<FlatList
							data={availability!.slots}
							keyExtractor={slot => slot}
							numColumns={3}
							columnWrapperStyle={styles.slotRow}
							renderItem={({ item }) => (
								<TouchableOpacity
									style={[styles.slot, selectedSlot === item && styles.slotSelected]}
									onPress={() => setSelectedSlot(item)}
								>
									<Text style={[styles.slotText, selectedSlot === item && styles.slotTextSelected]}>
										{formatTime(item)}
									</Text>
								</TouchableOpacity>
							)}
							style={styles.slotList}
						/>
					)}

					<TouchableOpacity
						style={[styles.confirmBtn, (!selectedSlot || reschedule.isPending) && styles.confirmBtnDisabled]}
						onPress={handleConfirm}
						disabled={!selectedSlot || reschedule.isPending}
					>
						{reschedule.isPending ? (
							<ActivityIndicator color="#ffffff" />
						) : (
							<Text style={styles.confirmBtnText}>Confirm Reschedule</Text>
						)}
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "flex-end",
	},
	sheet: {
		backgroundColor: "#ffffff",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 24,
		paddingBottom: 36,
		maxHeight: "80%",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	title: { fontSize: 18, fontWeight: "700", color: "#1A2238" },
	close: { fontSize: 18, color: "#6B7280", padding: 4 },
	datePicker: {
		backgroundColor: "#F9FAFB",
		borderRadius: 10,
		padding: 14,
		marginBottom: 16,
	},
	dateLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 3 },
	dateValue: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	slotsLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 10 },
	slotList: { marginBottom: 16 },
	slotRow: { gap: 8, marginBottom: 8 },
	slot: {
		flex: 1,
		borderWidth: 1.5,
		borderColor: "#E5E7EB",
		borderRadius: 8,
		paddingVertical: 10,
		alignItems: "center",
	},
	slotSelected: { borderColor: "#E85A28", backgroundColor: "#FFF7F4" },
	slotText: { fontSize: 13, color: "#374151", fontWeight: "500" },
	slotTextSelected: { color: "#E85A28", fontWeight: "700" },
	loader: { marginVertical: 20 },
	noSlots: { color: "#9CA3AF", fontSize: 14, marginBottom: 16, textAlign: "center" },
	confirmBtn: {
		backgroundColor: "#E85A28",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
	},
	confirmBtnDisabled: { opacity: 0.4 },
	confirmBtnText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
});
