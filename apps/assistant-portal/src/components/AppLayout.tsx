import { LayoutDashboard, Calendar, Users, User, LogOut, Pill, Star, Menu, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";

import keycloak from "../keycloak";

interface KeycloakTokenParsed {
	realm_access?: { roles: string[] };
	name?: string;
	preferred_username?: string;
}

const MENU_ITEMS = [
	{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
	{ to: "/appointments", icon: Calendar, label: "Appointments" },
	{ to: "/patients", icon: User, label: "Patients" },
	{ to: "/prescriptions", icon: Pill, label: "Prescriptions" },
	{ to: "/reviews", icon: Star, label: "Reviews" },
	{ to: "/admin", icon: Users, label: "Admin" },
];

function SidebarContent({
	isAdmin,
	displayName,
	collapsed,
}: {
	isAdmin: boolean;
	displayName: string;
	collapsed?: boolean;
}): React.ReactElement {
	const items = isAdmin ? MENU_ITEMS : MENU_ITEMS.filter(i => i.to !== "/admin");

	return (
		<>
			<div className={`border-b border-white/10 mb-2 ${collapsed ? "py-5 text-center" : "px-4 py-5"}`}>
				{!collapsed && (
					<>
						<div className="text-[11px] text-white/40 tracking-[2px] uppercase">Cerios Clinic</div>
						<div className="font-bold text-white text-[15px] mt-0.5">Assistant Portal</div>
					</>
				)}
			</div>

			<nav className="flex-1 px-2 py-1 space-y-0.5">
				{items.map(item => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
								isActive ? "bg-brand-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
							}`
						}
					>
						<item.icon size={18} />
						{!collapsed && item.label}
					</NavLink>
				))}
			</nav>

			<div className="border-t border-white/10">
				{!collapsed && (
					<div className="px-4 pt-3 pb-1">
						<div className="text-[13px] font-semibold text-white/85 truncate">{displayName}</div>
					</div>
				)}
				<button
					onClick={() => {
						void keycloak.logout({ redirectUri: window.location.origin + "/login" });
					}}
					className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
				>
					<LogOut size={18} />
					{!collapsed && "Sign out"}
				</button>
			</div>
		</>
	);
}

export default function AppLayout(): React.ReactElement {
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();

	const roles: string[] = (keycloak.tokenParsed as KeycloakTokenParsed)?.realm_access?.roles ?? [];
	const isAdmin = roles.includes("admin");

	const displayName =
		(keycloak.tokenParsed as KeycloakTokenParsed)?.name ??
		(keycloak.tokenParsed as KeycloakTokenParsed)?.preferred_username ??
		"Unknown";

	// Close mobile drawer on navigation
	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	return (
		<div className="min-h-screen flex flex-col">
			{/* Mobile top bar */}
			<div className="lg:hidden bg-brand-navy text-white flex items-center justify-between px-4 h-14 shrink-0">
				<span className="font-bold text-sm">Assistant Portal</span>
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
						<SidebarContent isAdmin={isAdmin} displayName={displayName} />
					</aside>
				</div>
			)}

			<div className="flex flex-1">
				{/* Desktop sidebar */}
				<aside className="hidden lg:flex w-60 bg-brand-navy text-white flex-col shrink-0 sticky top-0 h-screen">
					<SidebarContent isAdmin={isAdmin} displayName={displayName} />
				</aside>

				{/* Main content */}
				<main className="flex-1 overflow-auto bg-brand-bg">
					<div className="px-4 sm:px-8 py-8">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
}
