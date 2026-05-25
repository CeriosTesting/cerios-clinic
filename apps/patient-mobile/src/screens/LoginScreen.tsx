import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } from "@env";
import React, { useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAuth } from "../auth/AuthContext";

const realmBaseUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
const forgotPasswordUrl = `${realmBaseUrl}/login-actions/reset-credentials?client_id=${encodeURIComponent(KEYCLOAK_CLIENT_ID)}`;
const registerUrl = `${realmBaseUrl}/protocol/openid-connect/registrations?client_id=${encodeURIComponent(KEYCLOAK_CLIENT_ID)}&response_type=code&scope=openid&redirect_uri=${encodeURIComponent("com.cerios.patient://oauth2redirect")}`;

export default function LoginScreen(): React.JSX.Element {
	const { login } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleLogin = async (): Promise<void> => {
		if (!username.trim() || !password) {
			setError("Please enter your username and password.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			await login(username.trim(), password);
		} catch (e) {
			const message = e instanceof Error && e.message ? e.message : "Login failed. Please try again.";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const openExternal = (url: string): void => {
		void Linking.openURL(url).catch(() => {
			setError("Could not open the browser.");
		});
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

				<TextInput
					style={styles.input}
					placeholder="Username or email"
					placeholderTextColor="#9CA3AF"
					value={username}
					onChangeText={setUsername}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="email-address"
					textContentType="username"
					editable={!loading}
					testID="login-username"
					accessibilityLabel="Username"
					returnKeyType="next"
				/>

				<TextInput
					style={styles.input}
					placeholder="Password"
					placeholderTextColor="#9CA3AF"
					value={password}
					onChangeText={setPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					textContentType="password"
					editable={!loading}
					testID="login-password"
					accessibilityLabel="Password"
					returnKeyType="go"
					onSubmitEditing={(): void => {
						void handleLogin();
					}}
				/>

				<TouchableOpacity
					style={[styles.button, loading && styles.buttonDisabled]}
					onPress={(): void => {
						void handleLogin();
					}}
					disabled={loading}
					testID="login-submit"
					accessibilityLabel="Sign in"
				>
					{loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign in</Text>}
				</TouchableOpacity>

				<View style={styles.linksRow}>
					<TouchableOpacity
						onPress={(): void => openExternal(forgotPasswordUrl)}
						disabled={loading}
						testID="login-forgot-password"
						accessibilityLabel="Forgot password"
					>
						<Text style={styles.link}>Forgot password?</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={(): void => openExternal(registerUrl)}
						disabled={loading}
						testID="login-register"
						accessibilityLabel="Create account"
					>
						<Text style={styles.link}>Create account</Text>
					</TouchableOpacity>
				</View>
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
	input: {
		borderWidth: 1,
		borderColor: "#E5E7EB",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
		color: "#1A2238",
		backgroundColor: "#ffffff",
		marginBottom: 12,
	},
	button: {
		backgroundColor: "#E85A28",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 4,
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
	linksRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 4,
	},
	link: {
		color: "#1A2238",
		fontSize: 13,
		fontWeight: "500",
	},
});
