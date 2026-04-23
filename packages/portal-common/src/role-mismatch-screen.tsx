import React from "react";

export interface RoleMismatchScreenProps {
	/**
	 * The role this portal requires. Used in the descriptive message
	 * (e.g. "This portal is for patients only.").
	 */
	audienceLabel: string;
	/** Single-character emoji/glyph shown above the message (default: 🚫). */
	emoji?: string;
	/** Handler for the "Sign out" button. */
	onSignOut: () => void;
}

const containerStyle: React.CSSProperties = {
	minHeight: "100vh",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	fontFamily: "Inter, system-ui, sans-serif",
	background: "#f3f4f6",
};

const cardStyle: React.CSSProperties = {
	background: "#fff",
	borderRadius: 12,
	padding: "48px 40px",
	textAlign: "center",
	boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
	maxWidth: 400,
};

const headingStyle: React.CSSProperties = {
	fontSize: 22,
	fontWeight: 700,
	color: "#1A2238",
	marginBottom: 8,
};

const buttonStyle: React.CSSProperties = {
	background: "#E85A28",
	color: "#fff",
	border: "none",
	borderRadius: 8,
	padding: "10px 28px",
	fontWeight: 600,
	cursor: "pointer",
	fontSize: 15,
};

/** Access-denied / role-mismatch screen shown when an authenticated user lacks the portal's required realm role. */
export function RoleMismatchScreen({
	audienceLabel,
	emoji = "🚫",
	onSignOut,
}: RoleMismatchScreenProps): React.JSX.Element {
	return (
		<div style={containerStyle}>
			<div style={cardStyle}>
				<div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
				<h1 style={headingStyle}>Access Denied</h1>
				<p style={{ color: "#6b7280", marginBottom: 24 }}>
					This portal is for {audienceLabel} only. Your account does not have the required role.
				</p>
				<button onClick={onSignOut} style={buttonStyle}>
					Sign out
				</button>
			</div>
		</div>
	);
}

/** Fallback screen shown when Keycloak initialization fails. */
export function AuthServiceUnavailableScreen(): React.JSX.Element {
	return (
		<div style={containerStyle}>
			<div style={cardStyle}>
				<h1 style={headingStyle}>Service Unavailable</h1>
				<p style={{ color: "#6b7280" }}>Authentication service is unavailable. Please try again later.</p>
			</div>
		</div>
	);
}
