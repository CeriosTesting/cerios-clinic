import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface State {
	hasError: boolean;
}

interface Props {
	children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	handleReset = (): void => {
		this.setState({ hasError: false });
	};

	render(): React.ReactNode {
		if (this.state.hasError) {
			return (
				<View style={styles.container}>
					<Text style={styles.title}>Something went wrong</Text>
					<Text style={styles.subtitle}>The app encountered an unexpected error.</Text>
					<TouchableOpacity style={styles.button} onPress={this.handleReset}>
						<Text style={styles.buttonText}>Try Again</Text>
					</TouchableOpacity>
				</View>
			);
		}
		return this.props.children;
	}
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#F9FAFB" },
	title: { fontSize: 20, fontWeight: "700", color: "#1A2238", marginBottom: 8 },
	subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 },
	button: { backgroundColor: "#E85A28", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
	buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
});
