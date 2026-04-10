import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import keycloak from "./keycloak";
import AppointmentDetailPage from "./pages/AppointmentDetailPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import DoctorsPage from "./pages/DoctorsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MedicalHistoryPage from "./pages/MedicalHistoryPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";

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
				<Route path="/register" element={<RegisterPage />} />
				<Route
					path="/"
					element={
						<ProtectedRoute>
							<Layout />
						</ProtectedRoute>
					}
				>
					<Route index element={<HomePage />} />
					<Route path="appointments" element={<AppointmentsPage />} />
					<Route path="appointments/:id" element={<AppointmentDetailPage />} />
					<Route path="medical-history" element={<MedicalHistoryPage />} />
					<Route path="doctors" element={<DoctorsPage />} />
					<Route path="profile" element={<ProfilePage />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
