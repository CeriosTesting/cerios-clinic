import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import keycloak from "./keycloak";

void keycloak
	.init({
		onLoad: "check-sso",
		pkceMethod: "S256",
		checkLoginIframe: false,
	})
	.then(authenticated => {
		const root = createRoot(document.getElementById("root")!);
		if (authenticated && !keycloak.hasRealmRole("assistant") && !keycloak.hasRealmRole("admin")) {
			root.render(
				<div
					style={{
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						fontFamily: "Inter, system-ui, sans-serif",
						background: "#f3f4f6",
					}}
				>
					<div
						style={{
							background: "#fff",
							borderRadius: 12,
							padding: "48px 40px",
							textAlign: "center",
							boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
							maxWidth: 400,
						}}
					>
						<div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
						<h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2238", marginBottom: 8 }}>Access Denied</h1>
						<p style={{ color: "#6b7280", marginBottom: 24 }}>
							This portal is for assistants only. Your account does not have the required role.
						</p>
						<button
							onClick={() => {
								void keycloak.logout();
							}}
							style={{
								background: "#E85A28",
								color: "#fff",
								border: "none",
								borderRadius: 8,
								padding: "10px 28px",
								fontWeight: 600,
								cursor: "pointer",
								fontSize: 15,
							}}
						>
							Sign out
						</button>
					</div>
				</div>
			);
			return;
		}
		root.render(
			<React.StrictMode>
				<App />
			</React.StrictMode>
		);
	})
	.catch(() => {
		createRoot(document.getElementById("root")!).render(
			<div
				style={{
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Inter, system-ui, sans-serif",
					background: "#f3f4f6",
				}}
			>
				<div
					style={{
						background: "#fff",
						borderRadius: 12,
						padding: "48px 40px",
						textAlign: "center",
						boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
						maxWidth: 400,
					}}
				>
					<h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2238", marginBottom: 8 }}>Service Unavailable</h1>
					<p style={{ color: "#6b7280" }}>Authentication service is unavailable. Please try again later.</p>
				</div>
			</div>
		);
	});
