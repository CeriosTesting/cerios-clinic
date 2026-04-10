/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					navy: "#1A2238",
					orange: "#E85A28",
					"orange-hover": "#C94A1E",
					"navy-light": "#243050",
					"bg-soft": "#F5F7FA",
				},
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
