import { ConfigProvider, theme } from "antd";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import keycloak from "./keycloak";
import AdminPage from "./pages/AdminPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import CreateAppointmentPage from "./pages/CreateAppointmentPage";
import DashboardPage from "./pages/DashboardPage";
import EditAppointmentPage from "./pages/EditAppointmentPage";
import LoginPage from "./pages/LoginPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import PatientsPage from "./pages/PatientsPage";
import PrescriptionsPage from "./pages/PrescriptionsPage";
import ReviewsPage from "./pages/ReviewsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }): React.ReactElement | null {
	if (!keycloak.authenticated) {
		return <Navigate to="/login" replace />;
	}
	return <>{children}</>;
}

export default function App(): React.ReactElement {
	return (
		<ConfigProvider
			theme={{
				algorithm: theme.defaultAlgorithm,
				token: {
					colorPrimary: "#E85A28",
					colorLink: "#E85A28",
					borderRadius: 8,
					fontFamily: "Inter, system-ui, sans-serif",
				},
				components: {
					Layout: {
						siderBg: "#1A2238",
						triggerBg: "#131929",
					},
					Menu: {
						darkItemBg: "#1A2238",
						darkItemSelectedBg: "#E85A28",
						darkItemHoverBg: "rgba(255,255,255,0.08)",
					},
				},
			}}
		>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route
						element={
							<ProtectedRoute>
								<AppLayout />
							</ProtectedRoute>
						}
					>
						<Route index element={<DashboardPage />} />
						<Route path="appointments" element={<AppointmentsPage />} />
						<Route path="appointments/create" element={<CreateAppointmentPage />} />
						<Route path="appointments/:id/edit" element={<EditAppointmentPage />} />
						<Route path="patients" element={<PatientsPage />} />
						<Route path="patients/:id" element={<PatientDetailPage />} />
						<Route path="admin" element={<AdminPage />} />
						<Route path="prescriptions" element={<PrescriptionsPage />} />
						<Route path="reviews" element={<ReviewsPage />} />
					</Route>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</BrowserRouter>
		</ConfigProvider>
	);
}
