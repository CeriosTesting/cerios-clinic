import { EventsModule, JwtAuthGuard, MailModule, SlowdownMiddleware, UiTogglesModule } from "@clinic/api-common";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";

import { AppointmentsModule } from "./appointments/appointments.module";
import { AuthModule } from "./auth/auth.module";
import { EventsModule as AppEventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { PatientsModule } from "./patients/patients.module";
import { PrescriptionsModule } from "./prescriptions/prescriptions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";

@Module({
	imports: [
		ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
		PrismaModule,
		MailModule,
		EventsModule,
		AuthModule,
		AppointmentsModule,
		PatientsModule,
		PrescriptionsModule,
		ReviewsModule,
		AppEventsModule,
		UiTogglesModule,
		HealthModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(SlowdownMiddleware).forRoutes("*");
	}
}
