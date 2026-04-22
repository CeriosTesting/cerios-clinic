import { EventsService, AppointmentEvent } from "@clinic/api-common";
import { Controller, Sse, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
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
	appointmentEvents(): Observable<MessageEvent> {
		// Assistants see all appointment events
		return this.events.appointment$.pipe(
			map((event: AppointmentEvent) => ({ data: JSON.stringify(event) }) as MessageEvent)
		);
	}
}
