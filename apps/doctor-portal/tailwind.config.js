/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/portal-common/src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				"brand-navy": "#1E3A5F",
				"brand-orange": "#1D4ED8",
				"brand-orange-hover": "#1E40AF",
				"brand-bg": "#EFF6FF",
			},
		},
	},
	plugins: [],
};
