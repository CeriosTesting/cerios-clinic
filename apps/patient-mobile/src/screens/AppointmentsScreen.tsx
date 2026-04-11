import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAppointments } from "../api/hooks";
import { StatusBadge } from "../components/StatusBadge";
import type { AppointmentsStackParamList } from "../navigation/AppNavigator";
import type { Appointment, AppointmentStatus } from "../types";
import { formatDate, formatTime } from "../utils/dateUtils";

type Nav = NativeStackNavigationProp<AppointmentsStackParamList, "AppointmentsList">;

const UPCOMING: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED"];
const PAST: AppointmentStatus[] = ["COMPLETED", "CANCELLED"];

export default function AppointmentsScreen(): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const { data: appointments, isLoading, refetch } = useAppointments();
	const [search, setSearch] = useState("");

	const { filtered, upcoming, past } = useMemo(() => {
		const q = search.toLowerCase();
		const f = appointments
			? q
				? appointments.filter(a => {
						const name = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
						return name.includes(q);
					})
				: appointments
			: [];
		return {
			filtered: f,
			upcoming: f.filter(a => UPCOMING.includes(a.status)),
			past: f.filter(a => PAST.includes(a.status)),
		};
	}, [appointments, search]);

	const renderItem = useCallback(
		({ item, index }: { item: Appointment; index: number }) => {
			const isFirstPast = index === upcoming.length && past.length > 0;
			return (
				<>
					{isFirstPast && <SectionHeader title="Past" />}
					<AppointmentCard appt={item} onPress={() => navigation.navigate("AppointmentDetail", { id: item.id })} />
				</>
			);
		},
		[upcoming.length, past.length, navigation]
	);

	return (
		<View style={styles.container}>
			<TextInput
				style={styles.search}
				placeholder="Search by doctor name..."
				placeholderTextColor="#9CA3AF"
				value={search}
				onChangeText={setSearch}
			/>

			<FlatList
				data={[...upcoming, ...past]}
				keyExtractor={item => item.id}
				refreshControl={
					<RefreshControl
						refreshing={isLoading}
						onRefresh={(): void => {
							void refetch();
						}}
					/>
				}
				ListHeaderComponent={upcoming.length > 0 ? <SectionHeader title="Upcoming" /> : null}
				renderItem={renderItem}
				ListEmptyComponent={
					!isLoading ? (
						<View style={styles.empty}>
							<Text style={styles.emptyIcon}>📅</Text>
							<Text style={styles.emptyText}>No appointments found.</Text>
							<Text style={styles.emptyHint}>Contact your clinic to schedule one.</Text>
						</View>
					) : null
				}
				contentContainerStyle={styles.list}
			/>
		</View>
	);
}

function SectionHeader({ title }: { title: string }): React.JSX.Element {
	return <Text style={styles.sectionHeader}>{title}</Text>;
}

const AppointmentCard = React.memo(function AppointmentCard({
	appt,
	onPress,
}: {
	appt: Appointment;
	onPress: () => void;
}): React.JSX.Element {
	const doctor = appt.doctor?.user;
	return (
		<TouchableOpacity style={styles.card} onPress={onPress}>
			<View style={styles.cardBody}>
				<Text style={styles.cardDoctor}>
					Dr. {doctor?.firstName} {doctor?.lastName}
				</Text>
				{appt.doctor?.specialization ? <Text style={styles.cardSpec}>{appt.doctor.specialization}</Text> : null}
				<Text style={styles.cardDate}>
					{formatDate(appt.scheduledAt)} · {formatTime(appt.scheduledAt)}
				</Text>
			</View>
			<StatusBadge status={appt.status} />
		</TouchableOpacity>
	);
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	search: {
		margin: 16,
		paddingHorizontal: 14,
		paddingVertical: 10,
		backgroundColor: "#ffffff",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		fontSize: 14,
		color: "#111827",
	},
	list: { paddingHorizontal: 16, paddingBottom: 32 },
	sectionHeader: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1A2238",
		marginTop: 8,
		marginBottom: 8,
	},
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 10,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	cardBody: { flex: 1 },
	cardDoctor: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	cardSpec: { fontSize: 13, color: "#6B7280", marginTop: 2 },
	cardDate: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
	empty: { alignItems: "center", paddingTop: 60 },
	emptyIcon: { fontSize: 48, marginBottom: 12 },
	emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
	emptyHint: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
});
