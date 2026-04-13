import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useDoctors } from "../api/hooks";

export default function DoctorsScreen(): React.JSX.Element {
	const { data: doctors, isLoading, refetch } = useDoctors();

	return (
		<FlatList
			data={doctors ?? []}
			keyExtractor={item => item.id}
			numColumns={2}
			columnWrapperStyle={styles.row}
			refreshControl={
				<RefreshControl
					refreshing={isLoading}
					onRefresh={(): void => {
						void refetch();
					}}
				/>
			}
			contentContainerStyle={styles.list}
			renderItem={({ item }) => (
				<View style={styles.card}>
					<View style={styles.avatar}>
						<Text style={styles.avatarText}>
							{item.firstName[0]}
							{item.lastName[0]}
						</Text>
					</View>
					<Text style={styles.name} numberOfLines={1}>
						Dr. {item.firstName} {item.lastName}
					</Text>
					<Text style={styles.spec} numberOfLines={2}>
						{item.specialization ?? "General Practice"}
					</Text>
					{(item as { averageRating?: number }).averageRating ? (
						<View style={styles.ratingRow}>
							<Text style={styles.star}>★</Text>
							<Text style={styles.ratingText}>
								{((item as { averageRating?: number }).averageRating ?? 0).toFixed(1)}
							</Text>
							<Text style={styles.reviewCount}>({(item as { reviewCount?: number }).reviewCount ?? 0})</Text>
						</View>
					) : null}
				</View>
			)}
			ListEmptyComponent={
				!isLoading ? (
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No doctors available.</Text>
					</View>
				) : null
			}
		/>
	);
}

const styles = StyleSheet.create({
	list: { padding: 16 },
	row: { gap: 12, marginBottom: 12 },
	card: {
		flex: 1,
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "#1A2238",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 10,
	},
	avatarText: { color: "#E85A28", fontWeight: "700", fontSize: 16 },
	name: { fontSize: 14, fontWeight: "600", color: "#1A2238", textAlign: "center" },
	spec: { fontSize: 12, color: "#6B7280", marginTop: 3, textAlign: "center" },
	ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 3 },
	star: { fontSize: 14, color: "#F59E0B" },
	ratingText: { fontSize: 12, fontWeight: "600", color: "#1A2238" },
	reviewCount: { fontSize: 11, color: "#9CA3AF" },
	empty: { alignItems: "center", paddingTop: 60 },
	emptyText: { fontSize: 15, color: "#9CA3AF" },
});
