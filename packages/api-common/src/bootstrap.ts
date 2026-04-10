import { Logger, Type, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

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
	const app = await NestFactory.create(options.appModule);
	app.enableShutdownHooks();

	app.use(helmet());
	app.enableCors({ origin: options.corsOrigins, credentials: true });
	const prefix = options.globalPrefix ?? "api";
	app.setGlobalPrefix(prefix);
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		})
	);

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
