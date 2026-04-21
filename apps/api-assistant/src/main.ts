import "reflect-metadata";

import { bootstrapApi, parseBoolEnv } from "@clinic/api-common";

import { AppModule } from "./app.module";
import { getApiRuntimeEnv } from "./config/env";

async function bootstrap(): Promise<void> {
	const env = getApiRuntimeEnv();

	await bootstrapApi({
		appModule: AppModule,
		serviceName: "Assistant API",
		port: env.port,
		corsOrigins: env.corsOrigins,
		swaggerTitle: "Assistant API",
		swaggerDescription: "API for the Assistant Portal - appointment management and admin",
		enableSwagger: parseBoolEnv("ENABLE_SWAGGER", env.nodeEnv !== "production"),
	});
}
void bootstrap();
