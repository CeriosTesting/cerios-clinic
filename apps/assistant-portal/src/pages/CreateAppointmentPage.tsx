import "react-datepicker/dist/react-datepicker.css";

import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Select from "react-select";

import api from "../api";

interface PatientOption {
	id: string;
	userId: string;
	user: { firstName: string; lastName: string; email: string };
}
interface DoctorOption {
	id: string;
	userId: string;
	user: { firstName: string; lastName: string };
	specialization: string;
}

interface FormValues {
	patientId: { value: string; label: string } | null;
	doctorId: { value: string; label: string } | null;
	scheduledAt: Date | null;
	notes: string;
}

export default function CreateAppointmentPage(): React.ReactElement {
	const navigate = useNavigate();
	const {
		control,
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormValues>({
		defaultValues: { patientId: null, doctorId: null, scheduledAt: null, notes: "" },
	});
	const [doctors, setDoctors] = useState<DoctorOption[]>([]);
	const [patients, setPatients] = useState<PatientOption[]>([]);
	const [searchQ, setSearchQ] = useState("");
	const [searching, setSearching] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		void api
			.get<{ data: DoctorOption[] }>("/patients/doctors")
			.then(r => setDoctors(r.data.data))
			.catch(() => toast.error("Failed to load doctors. Please refresh."));
	}, []);

	const searchPatients = async (q: string): Promise<void> => {
		setSearchQ(q);
		if (q.length < 2) {
			setPatients([]);
			return;
		}
		setSearching(true);
		try {
			const r = await api.get<{ data: PatientOption[] }>("/patients", { params: { q } });
			setPatients(r.data.data);
		} finally {
			setSearching(false);
		}
	};

	const onSubmit = async (values: FormValues): Promise<void> => {
		setSubmitting(true);
		try {
			await api.post("/appointments", {
				patientId: values.patientId!.value,
				doctorId: values.doctorId!.value,
				scheduledAt: values.scheduledAt!.toISOString(),
				notes: values.notes ?? "",
			});
			toast.success("Appointment created!");
			void navigate("/appointments");
		} catch {
			toast.error("Could not create appointment.");
		} finally {
			setSubmitting(false);
		}
	};

	const patientOptions = patients.map(p => ({
		value: p.id,
		label: `${p.user.firstName} ${p.user.lastName} — ${p.user.email}`,
	}));

	const doctorOptions = doctors.map(d => ({
		value: d.id,
		label: `Dr. ${d.user.firstName} ${d.user.lastName} — ${d.specialization}`,
	}));

	return (
		<div className="max-w-lg">
			<button
				className="btn-link text-brand-accent pl-0"
				onClick={() => {
					void navigate("/appointments");
				}}
			>
				← Back
			</button>
			<h1 className="text-2xl font-bold text-brand-navy mt-2 mb-4">New appointment</h1>

			<div className="card">
				<form
					onSubmit={e => {
						void handleSubmit(onSubmit)(e);
					}}
					className="space-y-4"
				>
					<div>
						<label className="form-label">Patient</label>
						<Controller
							name="patientId"
							control={control}
							rules={{ required: "Select a patient" }}
							render={({ field }) => (
								<Select
									{...field}
									isSearchable
									isLoading={searching}
									placeholder="Search by name or email"
									noOptionsMessage={() => (searchQ.length < 2 ? "Type at least 2 characters" : "No patients found")}
									options={patientOptions}
									onInputChange={q => {
										void searchPatients(q);
									}}
									classNamePrefix="react-select"
								/>
							)}
						/>
						{errors.patientId && <p className="text-red-500 text-xs mt-1">{errors.patientId.message}</p>}
					</div>

					<div>
						<label className="form-label">Doctor</label>
						<Controller
							name="doctorId"
							control={control}
							rules={{ required: "Select a doctor" }}
							render={({ field }) => (
								<Select
									{...field}
									isSearchable
									placeholder="Select doctor"
									options={doctorOptions}
									classNamePrefix="react-select"
								/>
							)}
						/>
						{errors.doctorId && <p className="text-red-500 text-xs mt-1">{errors.doctorId.message}</p>}
					</div>

					<div>
						<label className="form-label">Date & Time</label>
						<Controller
							name="scheduledAt"
							control={control}
							rules={{ required: "Pick a date and time" }}
							render={({ field }) => (
								<DatePicker
									selected={field.value}
									onChange={field.onChange}
									showTimeSelect
									dateFormat="dd/MM/yyyy HH:mm"
									timeFormat="HH:mm"
									minDate={new Date()}
									placeholderText="Select date and time"
									className="form-input w-full"
								/>
							)}
						/>
						{errors.scheduledAt && <p className="text-red-500 text-xs mt-1">{errors.scheduledAt.message}</p>}
					</div>

					<div>
						<label className="form-label">Notes (optional)</label>
						<textarea {...register("notes")} rows={3} className="form-input w-full" />
					</div>

					<button type="submit" className="btn-primary w-full" disabled={submitting}>
						{submitting ? "Creating..." : "Create appointment"}
					</button>
				</form>
			</div>
		</div>
	);
}
