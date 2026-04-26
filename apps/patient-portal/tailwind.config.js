/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/portal-common/src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					navy: "#064E3B",
					orange: "#059669",
					"orange-hover": "#047857",
					"navy-light": "#065F46",
					"bg-soft": "#ECFDF5",
				},
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
