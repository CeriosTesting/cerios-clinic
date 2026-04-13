import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface AppointmentEvent {
	type: "appointment.created" | "appointment.updated" | "appointment.cancelled";
	appointmentId: string;
	patientId: string;
	doctorId: string;
	status: string;
	scheduledAt: string;
}

@Injectable()
export class EventsService {
	private readonly appointmentSubject = new Subject<AppointmentEvent>();
	readonly appointment$ = this.appointmentSubject.asObservable();

	emitAppointmentEvent(event: AppointmentEvent): void {
		this.appointmentSubject.next(event);
	}
}
