import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";

import { AdminModule } from "./admin/admin.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PatientsModule } from "./patients/patients.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
	imports: [
		ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
		PrismaModule,
		AuthModule,
		AppointmentsModule,
		PatientsModule,
		AdminModule,
		HealthModule,
	],
	providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
