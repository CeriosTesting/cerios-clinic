import { EventsService, AppointmentEvent } from "@clinic/api-common";
import { Controller, Sse, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Observable, filter, map } from "rxjs";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { KeycloakTokenPayload } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("patient")
@Controller("events")
export class EventsController {
	constructor(
		private readonly events: EventsService,
		private readonly prisma: PrismaService
	) {}

	@Sse("appointments")
	async appointmentEvents(@CurrentUser() user: KeycloakTokenPayload): Promise<Observable<MessageEvent>> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { patient: true },
		});
		if (!dbUser?.patient) throw new NotFoundException("Patient profile not found");

		const patientId = dbUser.patient.id;

		return this.events.appointment$.pipe(
			filter((event: AppointmentEvent) => event.patientId === patientId),
			map((event: AppointmentEvent) => ({ data: JSON.stringify(event) }) as MessageEvent)
		);
	}
}
