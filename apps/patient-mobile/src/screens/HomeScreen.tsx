import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import type { AppTabParamList } from "../navigation/AppNavigator";

type Nav = BottomTabNavigationProp<AppTabParamList>;

interface QuickAction {
	icon: string;
	label: string;
	description: string;
	tab: keyof AppTabParamList;
}

const QUICK_ACTIONS: QuickAction[] = [
	{ icon: "📅", label: "My Appointments", description: "View upcoming and past appointments", tab: "Appointments" },
	{ icon: "👨‍⚕️", label: "Our Doctors", description: "Browse available doctors", tab: "Doctors" },
	{ icon: "📋", label: "Medical History", description: "Completed appointments & notes", tab: "History" },
	{ icon: "👤", label: "My Profile", description: "Update personal details", tab: "Profile" },
];

export default function HomeScreen(): React.JSX.Element {
	const { user } = useAuth();
	const navigation = useNavigation<Nav>();

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			{/* Hero */}
			<View style={styles.hero}>
				<Text style={styles.heroTitle}>Good day, {user?.given_name ?? "Patient"}</Text>
				<Text style={styles.heroSub}>Manage your appointments and health profile.</Text>
				<TouchableOpacity style={styles.heroButton} onPress={() => navigation.navigate("Appointments")}>
					<Text style={styles.heroButtonText}>View My Appointments</Text>
				</TouchableOpacity>
			</View>

			{/* Quick actions */}
			<View style={styles.grid}>
				{QUICK_ACTIONS.map(action => (
					<TouchableOpacity key={action.tab} style={styles.actionCard} onPress={() => navigation.navigate(action.tab)}>
						<Text style={styles.actionIcon}>{action.icon}</Text>
						<View style={styles.actionText}>
							<Text style={styles.actionLabel}>{action.label}</Text>
							<Text style={styles.actionDesc}>{action.description}</Text>
						</View>
					</TouchableOpacity>
				))}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	content: { padding: 20 },
	hero: {
		backgroundColor: "#1A2238",
		borderRadius: 16,
		padding: 24,
		marginBottom: 24,
	},
	heroTitle: { fontSize: 22, fontWeight: "700", color: "#ffffff", marginBottom: 6 },
	heroSub: { fontSize: 14, color: "#93C5FD", marginBottom: 16 },
	heroButton: {
		backgroundColor: "#E85A28",
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignSelf: "flex-start",
	},
	heroButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
	grid: { gap: 12 },
	actionCard: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	actionIcon: { fontSize: 28 },
	actionText: { flex: 1 },
	actionLabel: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	actionDesc: { fontSize: 13, color: "#6B7280", marginTop: 2 },
});
