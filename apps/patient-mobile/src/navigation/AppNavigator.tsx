import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import AppointmentDetailScreen from "../screens/AppointmentDetailScreen";
import AppointmentsScreen from "../screens/AppointmentsScreen";
import DoctorsScreen from "../screens/DoctorsScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import MedicalHistoryScreen from "../screens/MedicalHistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";

// ── Param list types ──────────────────────────────────────────────────────────

export type AppointmentsStackParamList = {
	AppointmentsList: undefined;
	AppointmentDetail: { id: string };
};

export type AppTabParamList = {
	Home: undefined;
	Appointments: undefined;
	History: undefined;
	Doctors: undefined;
	Profile: undefined;
};

// ── Navigators ────────────────────────────────────────────────────────────────

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator<AppTabParamList>();
const ApptStack = createNativeStackNavigator<AppointmentsStackParamList>();

// Module-level constants — stable references, not recreated on every render
const TAB_ICONS: Record<string, string> = {
	Home: "🏠",
	Appointments: "📅",
	History: "📋",
	Doctors: "👨‍⚕️",
	Profile: "👤",
};

const tabScreenOptions = ({ route }: { route: { name: string } }): BottomTabNavigationOptions => ({
	tabBarIcon: ({ color }: { color: string }): React.JSX.Element => (
		<Text style={{ fontSize: 18, color }} accessibilityLabel={route.name}>
			{TAB_ICONS[route.name]}
		</Text>
	),
	tabBarActiveTintColor: "#E85A28",
	tabBarInactiveTintColor: "#9CA3AF",
	headerShown: false,
});

function AppointmentsStack(): React.JSX.Element {
	return (
		<ApptStack.Navigator screenOptions={{ headerShown: true }}>
			<ApptStack.Screen name="AppointmentsList" component={AppointmentsScreen} options={{ title: "Appointments" }} />
			<ApptStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} options={{ title: "Details" }} />
		</ApptStack.Navigator>
	);
}

function AppTabs(): React.JSX.Element {
	return (
		<Tab.Navigator screenOptions={tabScreenOptions}>
			<Tab.Screen name="Home" component={HomeScreen} />
			<Tab.Screen name="Appointments" component={AppointmentsStack} options={{ headerShown: false }} />
			<Tab.Screen name="History" component={MedicalHistoryScreen} options={{ title: "History" }} />
			<Tab.Screen name="Doctors" component={DoctorsScreen} />
			<Tab.Screen name="Profile" component={ProfileScreen} />
		</Tab.Navigator>
	);
}

export default function AppNavigator(): React.JSX.Element {
	const { user, isLoading } = useAuth();

	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}>
				<ActivityIndicator size="large" color="#1A2238" />
			</View>
		);
	}

	return (
		<NavigationContainer>
			{user ? (
				<AppTabs />
			) : (
				<AuthStack.Navigator screenOptions={{ headerShown: false }}>
					<AuthStack.Screen name="Login" component={LoginScreen} />
				</AuthStack.Navigator>
			)}
		</NavigationContainer>
	);
}
