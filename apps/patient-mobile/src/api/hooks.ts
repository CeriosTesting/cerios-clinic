import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import type { AxiosResponse } from "axios";

import type { Appointment, DoctorPublic, DoctorSlotAvailability, ProfileData, UpdateProfileDto } from "../types";

import api from "./client";

// ── Appointments ──────────────────────────────────────────────────────────────

export function useAppointments(): UseQueryResult<Appointment[], Error> {
	return useQuery({
		queryKey: ["appointments"],
		queryFn: async () => {
			const r = await api.get<{ data: Appointment[] }>("/appointments");
			return r.data.data;
		},
	});
}

export function useAppointmentHistory(): UseQueryResult<Appointment[], Error> {
	return useQuery({
		queryKey: ["appointments", "history"],
		queryFn: async () => {
			const r = await api.get<{ data: Appointment[] }>("/appointments/history");
			return r.data.data;
		},
	});
}

export function useAppointmentDetail(id: string): UseQueryResult<Appointment, Error> {
	return useQuery({
		queryKey: ["appointments", id],
		queryFn: async () => {
			const r = await api.get<{ data: Appointment }>(`/appointments/${id}`);
			return r.data.data;
		},
		enabled: !!id,
	});
}

export function useCancelAppointment(): UseMutationResult<AxiosResponse<{ data: Appointment }>, Error, string> {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.patch<{ data: Appointment }>(`/appointments/${id}/cancel`),
		onSuccess: (_data, id) => {
			void qc.invalidateQueries({ queryKey: ["appointments"] });
			void qc.invalidateQueries({ queryKey: ["appointments", id] });
		},
	});
}

export function useRescheduleAppointment(): UseMutationResult<
	AxiosResponse<{ data: Appointment }>,
	Error,
	{ id: string; scheduledAt: string }
> {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
			api.patch<{ data: Appointment }>(`/appointments/${id}/reschedule`, { scheduledAt }),
		onSuccess: (_data, { id }) => {
			void qc.invalidateQueries({ queryKey: ["appointments"] });
			void qc.invalidateQueries({ queryKey: ["appointments", id] });
		},
	});
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export function useDoctors(): UseQueryResult<DoctorPublic[], Error> {
	return useQuery({
		queryKey: ["doctors"],
		queryFn: async () => {
			const r = await api.get<{ data: DoctorPublic[] }>("/doctors");
			return r.data.data;
		},
	});
}

export function useDoctorSlots(doctorId: string, date: string): UseQueryResult<DoctorSlotAvailability, Error> {
	return useQuery({
		queryKey: ["doctorSlots", doctorId, date],
		queryFn: async () => {
			const r = await api.get<{ data: DoctorSlotAvailability[] }>(`/doctors/${doctorId}/slots?from=${date}&to=${date}`);
			return r.data.data[0] ?? { date, slots: [] };
		},
		enabled: !!doctorId && !!date,
	});
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function useProfile(): UseQueryResult<ProfileData, Error> {
	return useQuery({
		queryKey: ["profile"],
		queryFn: async () => {
			const r = await api.get<{ data: ProfileData }>("/profile");
			return r.data.data;
		},
	});
}

export function useUpdateProfile(): UseMutationResult<AxiosResponse<unknown>, Error, UpdateProfileDto> {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (dto: UpdateProfileDto) => api.put("/profile", dto),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["profile"] });
		},
	});
}
