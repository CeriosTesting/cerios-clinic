import "reflect-metadata";

import { bootstrapApi } from "@clinic/api-common";

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
		enableSwagger: env.nodeEnv !== "production",
	});
}
void bootstrap();
