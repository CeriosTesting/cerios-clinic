import { EventsService, AppointmentEvent } from "@clinic/api-common";
import { Controller, Sse, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Observable, map } from "rxjs";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant")
@Controller("events")
export class EventsController {
	constructor(private readonly events: EventsService) {}

	@Sse("appointments")
	@ApiOperation({ summary: "Stream appointment events for assistants" })
	@ApiProduces("text/event-stream")
	@ApiOkResponse({
		description: "Server-sent event stream carrying appointment event payloads.",
		schema: {
			type: "string",
			example:
				'data: {"type":"appointment.updated","appointmentId":"7c9e6679-7425-40de-944b-e07fc1f90ae7","patientId":"c56a4180-65aa-42ec-a945-5fd21dec0538","doctorId":"7d444840-9dc0-11d1-b245-5ffdce74fad2","status":"CONFIRMED","scheduledAt":"2026-06-15T09:30:00.000Z"}\n\n',
		},
	})
	appointmentEvents(): Observable<MessageEvent> {
		// Assistants see all appointment events
		return this.events.appointment$.pipe(
			map((event: AppointmentEvent) => ({ data: JSON.stringify(event) }) as MessageEvent)
		);
	}
}
