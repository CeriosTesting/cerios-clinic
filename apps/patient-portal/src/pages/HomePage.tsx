import React, { useEffect } from "react";
import { Link } from "react-router-dom";

import api from "../api";
import keycloak from "../keycloak";

export default function HomePage(): React.ReactElement {
	useEffect(() => {
		// Sync user after first login
		if (keycloak.tokenParsed) {
			const { sub, email, given_name, family_name } = keycloak.tokenParsed as Record<string, string>;
			api.post("/auth/sync", { keycloakId: sub, email, firstName: given_name, lastName: family_name }).catch(() => {
				/* Already synced */
			});
		}
	}, []);

	const name = keycloak.tokenParsed
		? `${(keycloak.tokenParsed as Record<string, string>).given_name ?? "Patient"}`
		: "Patient";

	return (
		<div>
			{/* Hero */}
			<div className="bg-brand-navy rounded-2xl p-8 mb-8 text-white">
				<h1 className="text-3xl font-bold mb-2">Good day, {name}</h1>
				<p className="text-blue-200 mb-6">Manage your appointments and health profile in one place.</p>
				<Link to="/appointments" className="btn-primary inline-block">
					View My Appointments
				</Link>
			</div>

			{/* Quick actions */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<Link to="/appointments" className="card hover:shadow-md transition-shadow group">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center">
							<span className="text-brand-orange text-2xl">📅</span>
						</div>
						<div>
							<h2 className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors">
								My Appointments
							</h2>
							<p className="text-sm text-gray-500">View upcoming and past appointments</p>
						</div>
					</div>
				</Link>

				<Link to="/profile" className="card hover:shadow-md transition-shadow group">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-brand-navy/10 rounded-xl flex items-center justify-center">
							<span className="text-brand-navy text-2xl">👤</span>
						</div>
						<div>
							<h2 className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors">
								My Profile
							</h2>
							<p className="text-sm text-gray-500">Update personal and insurance details</p>
						</div>
					</div>
				</Link>
			</div>
		</div>
	);
}
