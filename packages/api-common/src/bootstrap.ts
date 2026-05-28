import { Logger, Type, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";

import { DateOnlyResponseInterceptor } from "./date-only-response.interceptor";
import { PrismaExceptionFilter } from "./prisma-exception.filter";

export interface BootstrapApiOptions {
	appModule: Type<unknown>;
	serviceName: string;
	port: number;
	corsOrigins: string[];
	swaggerTitle: string;
	swaggerDescription: string;
	enableSwagger: boolean;
	globalPrefix?: string;
}

export async function bootstrapApi(options: BootstrapApiOptions): Promise<void> {
	// Disable Nest's default body parser so we can register ours with a 1MB limit
	// without double-parsing. Multipart file uploads continue to use their own
	// middleware (e.g. multer) and are not affected.
	const app = await NestFactory.create<NestExpressApplication>(options.appModule, { bodyParser: false });
	app.enableShutdownHooks();

	app.use(helmet());
	app.use(compression({ threshold: 1024 }));
	// Limit request body to 1 MB to prevent payload-based DoS
	app.useBodyParser("json", { limit: "1mb" });
	app.useBodyParser("urlencoded", { limit: "1mb", extended: true });
	app.enableCors({ origin: options.corsOrigins, credentials: true });
	const prefix = options.globalPrefix ?? "api";
	app.setGlobalPrefix(prefix);
	app.useGlobalFilters(new PrismaExceptionFilter());
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		})
	);
	// Normalizes `dateOfBirth` in JSON responses to `YYYY-MM-DD` so the payload
	// matches the OpenAPI `format: "date"` contract (Prisma returns it as Date).
	app.useGlobalInterceptors(new DateOnlyResponseInterceptor());

	if (options.enableSwagger) {
		const config = new DocumentBuilder()
			.setTitle(options.swaggerTitle)
			.setDescription(options.swaggerDescription)
			.setVersion("1.0")
			.addBearerAuth()
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup(`${prefix}/docs`, app, document);
	}

	await app.listen(options.port);

	const logger = new Logger(options.serviceName);
	logger.log(`${options.serviceName} running on http://localhost:${options.port}/${prefix}`);
	if (options.enableSwagger) {
		logger.log(`Swagger docs: http://localhost:${options.port}/${prefix}/docs`);
	}
}
