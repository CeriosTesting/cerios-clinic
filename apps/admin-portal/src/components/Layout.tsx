import { PortalFooter } from "@clinic/portal-common";
import { Menu, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";

import api from "../api";
import keycloak from "../keycloak";

interface KeycloakTokenParsed {
	realm_access?: { roles: string[] };
	name?: string;
	preferred_username?: string;
	email?: string;
}

const NAV_ITEMS = [
	{ to: "/", label: "User Management", end: true },
	{ to: "/feature-toggles", label: "Feature Toggles" },
];

function SidebarContent({ displayName, logout }: { displayName: string; logout: () => void }): React.ReactElement {
	return (
		<>
			<div className="px-6 py-5 border-b border-white/10">
				<span className="text-xs font-semibold tracking-widest uppercase text-white/50">Cerios Clinic</span>
				<p className="text-lg font-bold mt-0.5">Admin Portal</p>
			</div>
			<nav className="flex-1 px-3 py-4 space-y-1">
				{NAV_ITEMS.map(item => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
								isActive ? "bg-brand-orange text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
							}`
						}
					>
						{item.label}
					</NavLink>
				))}
			</nav>
			<div className="px-3 py-4 border-t border-white/10">
				<div className="px-3 py-2">
					<p className="text-sm font-medium text-white truncate">{displayName}</p>
					<p className="text-xs text-brand-orange truncate mt-0.5">Administrator</p>
					<p className="text-xs text-white/50 truncate mt-0.5">
						{(keycloak.tokenParsed as KeycloakTokenParsed)?.email as string}
					</p>
				</div>
				<button
					onClick={logout}
					className="mt-1 w-full flex items-center px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
				>
					Sign out
				</button>
			</div>
		</>
	);
}

export default function Layout(): React.ReactElement {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [showFooterLogo, setShowFooterLogo] = useState(false);
	const location = useLocation();

	const logout = (): void => {
		void keycloak.logout({ redirectUri: window.location.origin + "/login" });
	};

	const displayName =
		(keycloak.tokenParsed as KeycloakTokenParsed)?.name ??
		(keycloak.tokenParsed as KeycloakTokenParsed)?.preferred_username ??
		"Unknown";

	useEffect(() => {
		void api
			.get<{ data: { showFooterLogo: boolean } }>("/ui-toggles")
			.then(r => setShowFooterLogo(r.data.data.showFooterLogo))
			.catch(() => {});
	}, []);

	// Close mobile drawer on navigation
	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	return (
		<div className="min-h-screen flex flex-col">
			{/* Mobile top bar */}
			<div className="lg:hidden bg-brand-navy text-white flex items-center justify-between px-4 h-14 shrink-0">
				<span className="font-bold text-sm">Admin Portal</span>
				<button
					onClick={() => setMobileOpen(o => !o)}
					className="p-2 rounded-lg hover:bg-white/10 transition-colors"
					aria-label="Toggle menu"
				>
					{mobileOpen ? <X size={22} /> : <Menu size={22} />}
				</button>
			</div>

			{/* Mobile drawer overlay */}
			{mobileOpen && (
				<div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
					<div className="absolute inset-0 bg-black/30" />
					<aside
						className="absolute left-0 top-0 bottom-0 w-60 bg-brand-navy text-white flex flex-col"
						onClick={e => e.stopPropagation()}
					>
						<SidebarContent displayName={displayName} logout={logout} />
					</aside>
				</div>
			)}

			<div className="flex flex-1">
				{/* Desktop sidebar */}
				<aside className="hidden lg:flex w-60 bg-brand-navy text-white flex-col shrink-0">
					<SidebarContent displayName={displayName} logout={logout} />
				</aside>

				<main className="flex-1 overflow-auto">
					<div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
						<Outlet />
					</div>
				</main>
			</div>

			<PortalFooter portalName="Admin Portal" showLogo={showFooterLogo} />
		</div>
	);
}
