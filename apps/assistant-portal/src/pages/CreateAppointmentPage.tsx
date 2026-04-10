import { Button, Card, DatePicker, Form, Input, Select, Typography, message } from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

const { Title } = Typography;

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

export default function CreateAppointmentPage(): React.ReactElement {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const [doctors, setDoctors] = useState<DoctorOption[]>([]);
	const [doctorsLoading, setDoctorsLoading] = useState(false);
	const [patients, setPatients] = useState<PatientOption[]>([]);
	const [searchQ, setSearchQ] = useState("");
	const [searching, setSearching] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		setDoctorsLoading(true);
		void api
			.get<{ data: DoctorOption[] }>("/patients/doctors")
			.then(r => setDoctors(r.data.data))
			.catch(() => message.error("Failed to load doctors. Please refresh."))
			.finally(() => setDoctorsLoading(false));
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

	const onFinish = async (values: Record<string, unknown>): Promise<void> => {
		setSubmitting(true);
		try {
			await api.post("/appointments", {
				patientId: values.patientId,
				doctorId: values.doctorId,
				scheduledAt: (values.scheduledAt as { toISOString: () => string }).toISOString(),
				notes: values.notes ?? "",
			});
			message.success("Appointment created!");
			void navigate("/appointments");
		} catch {
			message.error("Could not create appointment.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div style={{ maxWidth: 560 }}>
			<Button
				type="link"
				style={{ paddingLeft: 0, color: "#E85A28" }}
				onClick={() => {
					void navigate("/appointments");
				}}
			>
				← Back
			</Button>
			<Title level={3} style={{ color: "#1A2238", marginTop: 8 }}>
				New appointment
			</Title>

			<Card>
				<Form
					form={form}
					layout="vertical"
					onFinish={values => {
						void onFinish(values as Record<string, unknown>);
					}}
				>
					<Form.Item name="patientId" label="Patient" rules={[{ required: true, message: "Select a patient" }]}>
						<Select
							showSearch={{
								filterOption: false,
								onSearch: (q: string) => {
									void searchPatients(q);
								},
							}}
							loading={searching}
							placeholder="Search by name or email"
							notFoundContent={searchQ.length < 2 ? "Type at least 2 characters" : "No patients found"}
							options={patients.map(p => ({
								value: p.id,
								label: `${p.user.firstName} ${p.user.lastName} — ${p.user.email}`,
							}))}
						/>
					</Form.Item>

					<Form.Item name="doctorId" label="Doctor" rules={[{ required: true, message: "Select a doctor" }]}>
						<Select
							placeholder="Select doctor"
							loading={doctorsLoading}
							options={doctors.map(d => ({
								value: d.id,
								label: `Dr. ${d.user.firstName} ${d.user.lastName} — ${d.specialization}`,
							}))}
						/>
					</Form.Item>

					<Form.Item
						name="scheduledAt"
						label="Date & Time"
						rules={[{ required: true, message: "Pick a date and time" }]}
					>
						<DatePicker
							showTime
							format="DD/MM/YYYY HH:mm"
							style={{ width: "100%" }}
							disabledDate={d => d && d < dayjs().startOf("day")}
						/>
					</Form.Item>

					<Form.Item name="notes" label="Notes (optional)">
						<Input.TextArea rows={3} />
					</Form.Item>

					<Form.Item style={{ marginBottom: 0 }}>
						<Button type="primary" htmlType="submit" loading={submitting} block>
							Create appointment
						</Button>
					</Form.Item>
				</Form>
			</Card>
		</div>
	);
}
