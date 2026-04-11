import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppointmentStatus } from "../types";

const STATUS_CONFIG: Record<AppointmentStatus, { bg: string; text: string; label: string }> = {
	SCHEDULED: { bg: "#DBEAFE", text: "#1D4ED8", label: "SCHEDULED" },
	CONFIRMED: { bg: "#DCFCE7", text: "#15803D", label: "CONFIRMED" },
	CANCELLED: { bg: "#FEE2E2", text: "#DC2626", label: "CANCELLED" },
	COMPLETED: { bg: "#F3F4F6", text: "#6B7280", label: "COMPLETED" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }): React.JSX.Element {
	const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.SCHEDULED;
	return (
		<View style={[styles.badge, { backgroundColor: config.bg }]}>
			<Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	badge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 20,
	},
	text: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.3,
	},
});
