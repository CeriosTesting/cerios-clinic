import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../auth/AuthContext";

export default function LoginScreen(): React.JSX.Element {
	const { login } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleLogin = async (): Promise<void> => {
		setLoading(true);
		setError("");
		try {
			await login();
		} catch {
			setError("Login failed. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.logo}>🏥</Text>
				<Text style={styles.title}>Cerios Clinic</Text>
				<Text style={styles.subtitle}>Your health, managed simply.</Text>
			</View>

			<View style={styles.card}>
				{error ? <Text style={styles.error}>{error}</Text> : null}

				<TouchableOpacity
					style={[styles.button, loading && styles.buttonDisabled]}
					onPress={(): void => {
						void handleLogin();
					}}
					disabled={loading}
				>
					{loading ? (
						<ActivityIndicator color="#ffffff" />
					) : (
						<Text style={styles.buttonText}>Sign in with Clinic Account</Text>
					)}
				</TouchableOpacity>

				<Text style={styles.hint}>Don't have an account? Register at the patient web portal.</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F9FAFB",
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	header: {
		alignItems: "center",
		marginBottom: 40,
	},
	logo: {
		fontSize: 64,
		marginBottom: 12,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: "#1A2238",
		marginBottom: 6,
	},
	subtitle: {
		fontSize: 15,
		color: "#6B7280",
	},
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 16,
		padding: 24,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 3,
	},
	button: {
		backgroundColor: "#E85A28",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
		marginBottom: 16,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
	error: {
		color: "#EF4444",
		marginBottom: 12,
		fontSize: 14,
		textAlign: "center",
	},
	hint: {
		fontSize: 13,
		color: "#9CA3AF",
		textAlign: "center",
	},
});
