import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/auth/AuthContext";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import AppNavigator from "./src/navigation/AppNavigator";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 30_000,
		},
	},
});

export default function App(): React.JSX.Element {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<SafeAreaProvider>
					<AuthProvider>
						<StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
						<AppNavigator />
					</AuthProvider>
				</SafeAreaProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
