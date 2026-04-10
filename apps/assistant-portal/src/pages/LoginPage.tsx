import React from "react";

import keycloak from "../keycloak";

const VIOLET = "#7C3AED";
const VIOLET_HOVER = "#6D28D9";
const DARK_VIOLET = "#1E1B4B";

export default function LoginPage(): React.ReactElement | null {
	if (keycloak.authenticated) {
		window.location.replace("/");
		return null;
	}

	const handleLogin = (): void => {
		void keycloak.login({ redirectUri: window.location.origin + "/" });
	};

	return (
		<div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
			{/* Left branding panel */}
			<div
				style={{
					width: "42%",
					minWidth: 280,
					background: DARK_VIOLET,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "48px 40px",
				}}
			>
				<div
					style={{
						width: 72,
						height: 72,
						borderRadius: 20,
						background: VIOLET,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: 28,
					}}
				>
					<span style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>A</span>
				</div>
				<div
					style={{
						fontSize: 11,
						color: "rgba(255,255,255,0.4)",
						letterSpacing: 3,
						textTransform: "uppercase",
						marginBottom: 10,
					}}
				>
					Cerios Clinic
				</div>
				<h1
					style={{
						fontSize: 26,
						fontWeight: 700,
						color: "#fff",
						margin: 0,
						marginBottom: 14,
						textAlign: "center",
					}}
				>
					Assistant Portal
				</h1>
				<p
					style={{
						fontSize: 14,
						color: "rgba(255,255,255,0.45)",
						textAlign: "center",
						lineHeight: 1.7,
						maxWidth: 220,
					}}
				>
					Manage appointments and coordinate patient care
				</p>
			</div>

			{/* Right sign-in panel */}
			<div
				style={{
					flex: 1,
					background: "#fff",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "48px 40px",
				}}
			>
				<div style={{ width: "100%", maxWidth: 360 }}>
					<h2 style={{ fontSize: 24, fontWeight: 700, color: DARK_VIOLET, marginBottom: 8, marginTop: 0 }}>
						Welcome back
					</h2>
					<p style={{ fontSize: 14, color: "#6b7280", marginBottom: 36, lineHeight: 1.7 }}>
						Sign in with your clinic credentials to continue. Authorized staff only.
					</p>
					<button
						onClick={handleLogin}
						onMouseOver={e => (e.currentTarget.style.background = VIOLET_HOVER)}
						onMouseOut={e => (e.currentTarget.style.background = VIOLET)}
						style={{
							width: "100%",
							background: VIOLET,
							color: "#fff",
							border: "none",
							borderRadius: 10,
							padding: "14px 24px",
							fontSize: 15,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
							transition: "background 0.15s",
						}}
					>
						Sign in
					</button>
					<p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 28 }}>
						Contact your administrator if you need help accessing your account.
					</p>
				</div>
			</div>
		</div>
	);
}
