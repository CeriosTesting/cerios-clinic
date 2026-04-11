import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAppointmentHistory } from "../api/hooks";
import { formatDate } from "../utils/dateUtils";

export default function MedicalHistoryScreen(): React.JSX.Element {
	const { data: appointments, isLoading, refetch } = useAppointmentHistory();

	return (
		<FlatList
			data={appointments ?? []}
			keyExtractor={item => item.id}
			refreshControl={
				<RefreshControl
					refreshing={isLoading}
					onRefresh={(): void => {
						void refetch();
					}}
				/>
			}
			contentContainerStyle={styles.list}
			renderItem={({ item }) => {
				const doctor = item.doctor?.user;
				return (
					<View style={styles.card}>
						<View style={styles.cardTop}>
							<View>
								<Text style={styles.doctor}>
									Dr. {doctor?.firstName} {doctor?.lastName}
								</Text>
								{item.doctor?.specialization ? <Text style={styles.spec}>{item.doctor.specialization}</Text> : null}
							</View>
							<Text style={styles.date}>{formatDate(item.scheduledAt)}</Text>
						</View>
						{item.notes ? (
							<Text style={styles.notes}>{item.notes}</Text>
						) : (
							<Text style={styles.noNotes}>No notes recorded</Text>
						)}
					</View>
				);
			}}
			ListEmptyComponent={
				!isLoading ? (
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No completed appointments yet.</Text>
					</View>
				) : null
			}
		/>
	);
}

const styles = StyleSheet.create({
	list: { padding: 16 },
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	cardTop: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 10,
	},
	doctor: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	spec: { fontSize: 13, color: "#6B7280", marginTop: 2 },
	date: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
	notes: {
		fontSize: 14,
		color: "#374151",
		borderTopWidth: 1,
		borderTopColor: "#F3F4F6",
		paddingTop: 10,
	},
	noNotes: {
		fontSize: 13,
		color: "#D1D5DB",
		fontStyle: "italic",
		borderTopWidth: 1,
		borderTopColor: "#F3F4F6",
		paddingTop: 10,
	},
	empty: { alignItems: "center", paddingTop: 60 },
	emptyText: { fontSize: 15, color: "#9CA3AF" },
});
