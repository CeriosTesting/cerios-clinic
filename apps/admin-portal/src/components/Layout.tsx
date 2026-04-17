import React from "react";
import { Outlet, NavLink } from "react-router-dom";

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

export default function Layout(): React.ReactElement {
	const logout = (): void => {
		void keycloak.logout({ redirectUri: window.location.origin + "/login" });
	};

	const displayName =
		(keycloak.tokenParsed as KeycloakTokenParsed)?.name ??
		(keycloak.tokenParsed as KeycloakTokenParsed)?.preferred_username ??
		"Unknown";

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex flex-1">
				<aside className="w-60 bg-brand-navy text-white flex flex-col shrink-0">
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
				</aside>

				<main className="flex-1 overflow-auto">
					<div className="max-w-5xl mx-auto px-6 py-8">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
}
