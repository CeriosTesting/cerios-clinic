import { EventsModule, JwtAuthGuard, MailModule } from "@clinic/api-common";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";

import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { FeatureTogglesModule } from "./feature-toggles/feature-toggles.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
	imports: [
		ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
		PrismaModule,
		MailModule,
		EventsModule,
		AuthModule,
		AdminModule,
		FeatureTogglesModule,
		HealthModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
	],
})
export class AppModule {}
