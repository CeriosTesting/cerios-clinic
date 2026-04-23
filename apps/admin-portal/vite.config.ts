import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5176,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: id => {
					if (id.includes("node_modules/keycloak-js/")) {
						return "vendor-keycloak";
					}
					if (
						id.includes("node_modules/react/") ||
						id.includes("node_modules/react-dom/") ||
						id.includes("node_modules/react-router/") ||
						id.includes("node_modules/react-router-dom/")
					) {
						return "vendor-react";
					}
					return undefined;
				},
			},
		},
	},
});
