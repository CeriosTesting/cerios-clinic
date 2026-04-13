import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { usePrescriptions } from "../api/hooks";
import type { Prescription } from "../types";

function PrescriptionCard({ item }: { item: Prescription }): React.JSX.Element {
	const [expanded, setExpanded] = useState(false);
	const doctorName = item.doctor?.user
		? `Dr. ${item.doctor.user.firstName} ${item.doctor.user.lastName}`
		: "Unknown Doctor";
	const date = new Date(item.createdAt).toLocaleDateString("en-NL", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return (
		<TouchableOpacity style={styles.card} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
			<View style={styles.cardHeader}>
				<Text style={styles.doctorName}>{doctorName}</Text>
				<Text style={styles.date}>{date}</Text>
			</View>
			<Text style={styles.itemCount}>
				{item.items.length} medication{item.items.length !== 1 ? "s" : ""}
			</Text>
			{item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

			{expanded && (
				<View style={styles.medications}>
					{item.items.map(med => (
						<View key={med.id} style={styles.medRow}>
							<Text style={styles.medName}>{med.medicationName}</Text>
							<Text style={styles.medDetail}>
								{med.dosage} · {med.frequency} · {med.duration}
							</Text>
							{med.instructions ? <Text style={styles.medInstructions}>{med.instructions}</Text> : null}
						</View>
					))}
				</View>
			)}
			<Text style={styles.expandHint}>{expanded ? "Tap to collapse" : "Tap to view medications"}</Text>
		</TouchableOpacity>
	);
}

const MemoizedCard = React.memo(PrescriptionCard);

export default function PrescriptionsScreen(): React.JSX.Element {
	const { data: prescriptions, isLoading, refetch } = usePrescriptions();
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!prescriptions) return [];
		if (!search.trim()) return prescriptions;
		const q = search.toLowerCase();
		return prescriptions.filter(
			p =>
				p.doctor?.user?.firstName.toLowerCase().includes(q) ||
				p.doctor?.user?.lastName.toLowerCase().includes(q) ||
				p.items.some(i => i.medicationName.toLowerCase().includes(q))
		);
	}, [prescriptions, search]);

	return (
		<View style={styles.container}>
			<TextInput
				style={styles.search}
				placeholder="Search by doctor or medication..."
				placeholderTextColor="#9CA3AF"
				value={search}
				onChangeText={setSearch}
			/>
			<FlatList
				data={filtered}
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
				renderItem={({ item }) => <MemoizedCard item={item} />}
				ListEmptyComponent={
					!isLoading ? (
						<View style={styles.empty}>
							<Text style={{ fontSize: 36 }}>💊</Text>
							<Text style={styles.emptyTitle}>No prescriptions</Text>
							<Text style={styles.emptyHint}>Your prescriptions from completed appointments will appear here.</Text>
						</View>
					) : null
				}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	search: {
		margin: 16,
		marginBottom: 0,
		backgroundColor: "#fff",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 10,
		fontSize: 14,
		color: "#1A2238",
		borderWidth: 1,
		borderColor: "#E5E7EB",
	},
	list: { padding: 16 },
	card: {
		backgroundColor: "#fff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	doctorName: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	date: { fontSize: 12, color: "#9CA3AF" },
	itemCount: { fontSize: 13, color: "#6B7280", marginTop: 4 },
	notes: { fontSize: 12, color: "#6B7280", marginTop: 4, fontStyle: "italic" },
	medications: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12 },
	medRow: { marginBottom: 10 },
	medName: { fontSize: 14, fontWeight: "600", color: "#1A2238" },
	medDetail: { fontSize: 12, color: "#6B7280", marginTop: 2 },
	medInstructions: { fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" },
	expandHint: { fontSize: 11, color: "#E85A28", textAlign: "center", marginTop: 8 },
	empty: { alignItems: "center", paddingTop: 60 },
	emptyTitle: { fontSize: 16, fontWeight: "600", color: "#1A2238", marginTop: 12 },
	emptyHint: { fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
});
