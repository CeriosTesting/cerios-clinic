import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		// Use process.env directly (not env() helper) so prisma generate works
		// without DATABASE_URL set. Migration scripts load .env via dotenv-cli.
		url: process.env.DATABASE_URL ?? "",
	},
});
