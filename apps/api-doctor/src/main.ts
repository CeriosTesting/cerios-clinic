import "reflect-metadata";

import { bootstrapApi, parseBoolEnv } from "@clinic/api-common";

import { AppModule } from "./app.module";
import { getApiRuntimeEnv } from "./config/env";

async function bootstrap(): Promise<void> {
	const env = getApiRuntimeEnv();

	await bootstrapApi({
		appModule: AppModule,
		serviceName: "Doctor API",
		port: env.port,
		corsOrigins: env.corsOrigins,
		swaggerTitle: "Doctor API",
		swaggerDescription: "API for the Doctor Portal",
		enableSwagger: parseBoolEnv("ENABLE_SWAGGER", env.nodeEnv !== "production"),
	});
}
void bootstrap();
