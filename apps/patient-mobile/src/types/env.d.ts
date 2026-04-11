declare module "@env" {
	export const API_URL: string;
	export const KEYCLOAK_URL: string;
	export const KEYCLOAK_REALM: string;
	export const KEYCLOAK_CLIENT_ID: string;
}

// Hermes / React Native provide atob and btoa as globals at runtime.
// TypeScript's React Native base lib doesn't include them, so we declare them here.
declare function atob(data: string): string;
declare function btoa(data: string): string;
