/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				"brand-navy": "#1A2238",
				"brand-orange": "#E85A28",
				"brand-orange-hover": "#C94A1E",
				"brand-bg": "#F5F7FA",
			},
		},
	},
	plugins: [],
};
