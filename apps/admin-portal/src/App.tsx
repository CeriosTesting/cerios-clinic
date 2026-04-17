import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import keycloak from "./keycloak";
import AdminPage from "./pages/AdminPage";
import FeatureTogglesPage from "./pages/FeatureTogglesPage";
import LoginPage from "./pages/LoginPage";

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
					<Route index element={<AdminPage />} />
					<Route path="feature-toggles" element={<FeatureTogglesPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
