/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				"brand-navy": "#164E63",
				"brand-primary": "#0891B2",
				"brand-primary-hover": "#0E7490",
				"brand-bg": "#F5F7FA",
				"brand-accent": "#E85A28",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
