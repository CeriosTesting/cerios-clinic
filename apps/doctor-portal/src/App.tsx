import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import keycloak from "./keycloak";
import AdminPage from "./pages/AdminPage";
import AppointmentDetailPage from "./pages/AppointmentDetailPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PatientDetailPage from "./pages/PatientDetailPage";

function ProtectedRoute({ children }: { children: React.ReactNode }): React.ReactElement | null {
	if (!keycloak.authenticated) {
		return <Navigate to="/login" replace />;
	}
	return <>{children}</>;
}

export default function App(): React.ReactElement {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route
					element={
						<ProtectedRoute>
							<Layout />
						</ProtectedRoute>
					}
				>
					<Route index element={<DashboardPage />} />
					<Route path="appointments" element={<AppointmentsPage />} />
					<Route path="appointments/:id" element={<AppointmentDetailPage />} />
					<Route path="patients/:id" element={<PatientDetailPage />} />
					<Route path="admin" element={<AdminPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
