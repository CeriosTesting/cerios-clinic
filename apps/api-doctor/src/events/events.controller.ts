import { EventsService, AppointmentEvent } from "@clinic/api-common";
import { Controller, Sse, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
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
@Roles("doctor")
@Controller("events")
export class EventsController {
	constructor(
		private readonly events: EventsService,
		private readonly prisma: PrismaService
	) {}

	@Sse("appointments")
	@ApiOperation({ summary: "Stream appointment events for the current doctor" })
	@ApiProduces("text/event-stream")
	@ApiOkResponse({
		description: "Server-sent event stream carrying appointment events for the authenticated doctor.",
		schema: {
			type: "string",
			example:
				'data: {"type":"appointment.updated","appointmentId":"7c9e6679-7425-40de-944b-e07fc1f90ae7","patientId":"c56a4180-65aa-42ec-a945-5fd21dec0538","doctorId":"7d444840-9dc0-11d1-b245-5ffdce74fad2","status":"CONFIRMED","scheduledAt":"2026-06-15T09:30:00.000Z"}\n\n',
		},
	})
	async appointmentEvents(@CurrentUser() user: KeycloakTokenPayload): Promise<Observable<MessageEvent>> {
		const dbUser = await this.prisma.user.findUnique({
			where: { keycloakId: user.sub, deletedAt: null },
			include: { doctor: true },
		});
		if (!dbUser?.doctor) throw new NotFoundException("Doctor profile not found");

		const doctorId = dbUser.doctor.id;

		return this.events.appointment$.pipe(
			filter((event: AppointmentEvent) => event.doctorId === doctorId),
			map((event: AppointmentEvent) => ({ data: JSON.stringify(event) }) as MessageEvent)
		);
	}
}
