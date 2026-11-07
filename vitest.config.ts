import { fileURLToPath } from "node:url";

import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Run every test in a non-UTC timezone with DST, so timezone bugs show up in tests.
// Set here (before workers start) and in `test.env` so all workers inherit it.
const TEST_TIMEZONE = "Europe/Amsterdam";
process.env.TZ = TEST_TIMEZONE;

const testUtils = fileURLToPath(new URL("./test-utils/index.ts", import.meta.url));

export default defineConfig({
	resolve: {
		alias: { "@clinic/test-utils": testUtils },
	},
	test: {
		env: { TZ: TEST_TIMEZONE },
		setupFiles: ["./test-utils/setup.ts"],
		restoreMocks: true,
		projects: [
			{
				extends: true,
				// NestJS needs decorator metadata for DI; SWC emits it, the default transformer does not.
				plugins: [
					swc.vite({
						jsc: {
							parser: { syntax: "typescript", decorators: true },
							transform: { legacyDecorator: true, decoratorMetadata: true },
						},
					}),
				],
				test: {
					name: "backend",
					setupFiles: ["./test-utils/setup-backend.ts"],
					// Dummy values: controllers import the JWT strategy, which reads these at module load.
					// Tests never talk to Keycloak, a database or SMTP.
					env: {
						KEYCLOAK_PATIENT_CLIENT_ID: "test-patient-client",
						KEYCLOAK_DOCTOR_CLIENT_ID: "test-doctor-client",
						KEYCLOAK_ASSISTANT_CLIENT_ID: "test-assistant-client",
						KEYCLOAK_ADMIN_PORTAL_CLIENT_ID: "test-admin-client",
						KEYCLOAK_ADMIN_CLIENT_SECRET: "test-secret",
					},
					environment: "node",
					include: ["packages/{api-common,shared-types}/src/**/*.test.ts", "apps/api-*/src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "frontend",
					environment: "node",
					include: ["packages/portal-common/src/**/*.test.ts", "apps/*-portal/src/**/*.test.ts"],
				},
			},
		],
		coverage: {
			provider: "v8",
			include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.{ts,tsx}"],
			exclude: ["**/*.test.ts", "apps/patient-mobile/**", "packages/database/**"],
			reporter: ["text-summary", "html"],
		},
	},
});
