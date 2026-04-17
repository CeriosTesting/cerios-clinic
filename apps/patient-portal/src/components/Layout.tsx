import React from "react";
import { Outlet, Link } from "react-router-dom";

import keycloak from "../keycloak";

interface KeycloakTokenParsed {
	name?: string;
	preferred_username?: string;
}

export default function Layout(): React.ReactElement {
	const handleLogout = (): void => {
		void keycloak.logout({ redirectUri: window.location.origin + "/login" });
	};

	const displayName =
		(keycloak.tokenParsed as KeycloakTokenParsed)?.name ??
		(keycloak.tokenParsed as KeycloakTokenParsed)?.preferred_username ??
		"Unknown";

	return (
		<div className="min-h-screen bg-brand-bg-soft">
			{/* Nav */}
			<nav className="bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<Link to="/" className="flex items-center gap-3">
							<div className="w-8 h-8 bg-brand-navy rounded-lg flex items-center justify-center">
								<span className="text-brand-orange font-bold text-sm">C</span>
							</div>
							<span className="font-semibold text-brand-navy text-lg">Patient Portal</span>
						</Link>
						<div className="flex items-center gap-6">
							<Link to="/appointments" className="nav-link">
								My Appointments
							</Link>
							<Link to="/medical-history" className="nav-link">
								Medical History
							</Link>
							<Link to="/prescriptions" className="nav-link">
								Prescriptions
							</Link>
							<Link to="/doctors" className="nav-link">
								Our Doctors
							</Link>
							<Link to="/profile" className="nav-link">
								Profile
							</Link>
							<div className="flex items-center gap-3 pl-3 border-l border-gray-200">
								<span className="text-sm font-medium text-brand-navy">{displayName}</span>
								<button onClick={handleLogout} className="btn-outline text-sm px-4 py-2">
									Sign out
								</button>
							</div>
						</div>
					</div>
				</div>
			</nav>

			{/* Main content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-14">
				<Outlet />
			</main>

			{/* Footer */}
			<footer className="fixed bottom-0 left-0 right-0 z-10 bg-brand-navy text-white text-center text-sm py-4">
				<p>Clinic Patient Portal &copy; {new Date().getFullYear()}</p>
			</footer>
		</div>
	);
}
