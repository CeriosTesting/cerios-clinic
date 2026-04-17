/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				"brand-navy": "#1E1B4B",
				"brand-orange": "#7C3AED",
				"brand-orange-hover": "#6D28D9",
				"brand-bg": "#F5F3FF",
			},
		},
	},
	plugins: [],
};
