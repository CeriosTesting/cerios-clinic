import { EventsService, AppointmentEvent } from "@clinic/api-common";
import { Controller, Sse, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Observable, map } from "rxjs";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
