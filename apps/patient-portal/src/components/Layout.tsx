import { PortalFooter } from "@clinic/portal-common";
import { Menu, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";

import api from "../api";
import keycloak from "../keycloak";

interface KeycloakTokenParsed {
	name?: string;
	preferred_username?: string;
}

interface ProfileNameData {
	firstName: string;
	lastName: string;
}

export const PROFILE_UPDATED_EVENT = "profile:updated";

const NAV_LINKS = [
	{ to: "/appointments", label: "My Appointments" },
	{ to: "/medical-history", label: "Medical History" },
	{ to: "/prescriptions", label: "Prescriptions" },
	{ to: "/doctors", label: "Our Doctors" },
	{ to: "/profile", label: "Profile" },
];

export default function Layout(): React.ReactElement {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [profileName, setProfileName] = useState<ProfileNameData | null>(null);
	const location = useLocation();

	const handleLogout = (): void => {
		void keycloak.logout({ redirectUri: window.location.origin + "/login" });
	};

	// Keep the header name in sync with the DB profile (source of truth for
	// edits made on the Profile page). The Keycloak token is only used as a
	// fallback until the profile has loaded.
	useEffect(() => {
		let cancelled = false;
		const loadProfile = (): void => {
			void api
				.get<{ data: ProfileNameData }>("/profile")
				.then(r => {
					if (!cancelled) {
						setProfileName({ firstName: r.data.data.firstName, lastName: r.data.data.lastName });
					}
				})
				.catch(() => {});
		};
		loadProfile();
		window.addEventListener(PROFILE_UPDATED_EVENT, loadProfile);
		return (): void => {
			cancelled = true;
			window.removeEventListener(PROFILE_UPDATED_EVENT, loadProfile);
		};
	}, []);

	const tokenParsed = keycloak.tokenParsed as KeycloakTokenParsed | undefined;
	const displayName = profileName
		? `${profileName.firstName} ${profileName.lastName}`.trim()
		: (tokenParsed?.name ?? tokenParsed?.preferred_username ?? "Unknown");

	// Close mobile menu on navigation
	React.useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	return (
		<div className="min-h-screen bg-brand-bg-soft">
			{/* Nav */}
			<nav className="bg-white border-b border-gray-200 shadow-sm relative z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<Link to="/" className="flex items-center gap-3">
							<div className="w-8 h-8 bg-brand-navy rounded-lg flex items-center justify-center">
								<span className="text-brand-orange font-bold text-sm">C</span>
							</div>
							<span className="font-semibold text-brand-navy text-lg">Patient Portal</span>
						</Link>

						{/* Desktop nav */}
						<div className="hidden md:flex items-center gap-6">
							{NAV_LINKS.map(link => (
								<NavLink
									key={link.to}
									to={link.to}
									className={({ isActive }) =>
										`nav-link ${isActive ? "text-brand-orange border-b-2 border-brand-orange pb-0.5" : ""}`
									}
								>
									{link.label}
								</NavLink>
							))}
							<div className="flex items-center gap-3 pl-3 border-l border-gray-200">
								<span className="text-sm font-medium text-brand-navy">{displayName}</span>
								<button onClick={handleLogout} className="btn-outline text-sm px-4 py-2">
									Sign out
								</button>
							</div>
						</div>

						{/* Hamburger button */}
						<button
							onClick={() => setMobileOpen(o => !o)}
							className="md:hidden p-2 rounded-lg text-brand-navy hover:bg-gray-100 transition-colors"
							aria-label="Toggle menu"
						>
							{mobileOpen ? <X size={24} /> : <Menu size={24} />}
						</button>
					</div>
				</div>

				{/* Mobile nav */}
				{mobileOpen && (
					<div className="md:hidden border-t border-gray-200 bg-white">
						<div className="px-4 py-3 space-y-1">
							{NAV_LINKS.map(link => (
								<NavLink
									key={link.to}
									to={link.to}
									className={({ isActive }) =>
										`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
											isActive
												? "bg-brand-bg-soft text-brand-orange"
												: "text-brand-navy hover:bg-brand-bg-soft hover:text-brand-orange"
										}`
									}
								>
									{link.label}
								</NavLink>
							))}
						</div>
						<div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
							<span className="text-sm font-medium text-brand-navy">{displayName}</span>
							<button onClick={handleLogout} className="btn-outline text-sm px-4 py-2">
								Sign out
							</button>
						</div>
					</div>
				)}
			</nav>

			{/* Backdrop for mobile menu */}
			{mobileOpen && <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} />}

			{/* Main content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Outlet />
			</main>

			<PortalFooter portalName="Patient Portal" />
		</div>
	);
}
