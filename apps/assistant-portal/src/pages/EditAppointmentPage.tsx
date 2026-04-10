import type { Appointment, AppointmentStatusChange } from "@clinic/shared-types";
import { ALLOWED_TRANSITIONS } from "@clinic/shared-types";
import { Button, Card, DatePicker, Form, Input, Select, Typography, message, Timeline, Tag } from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
	SCHEDULED: "blue",
	CONFIRMED: "green",
	COMPLETED: "default",
	CANCELLED: "red",
};

export default function EditAppointmentPage(): React.ReactElement | null {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const [appointment, setAppointment] = useState<Appointment | null>(null);
	const [history, setHistory] = useState<
		(AppointmentStatusChange & { changedByName?: string | null; changedByRole?: string | null })[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		void Promise.all([
			api.get<{ data: Appointment }>(`/appointments/${id}`),
			api.get<{ data: typeof history }>(`/appointments/${id}/history`),
		])
			.then(([apptRes, histRes]) => {
				const a = apptRes.data.data;
				setAppointment(a);
				form.setFieldsValue({
					status: a.status,
					scheduledAt: dayjs(a.scheduledAt),
					notes: a.notes ?? "",
				});
				setHistory(histRes.data.data);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [id]);

	const onFinish = async (values: Record<string, unknown>): Promise<void> => {
		setSubmitting(true);
		try {
			await api.put(`/appointments/${id}`, {
				status: values.status,
				scheduledAt: (values.scheduledAt as { toISOString: () => string }).toISOString(),
				notes: values.notes ?? "",
			});
			message.success("Appointment updated.");
			void navigate("/appointments");
		} catch (err: unknown) {
			message.error(
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
					"Could not update appointment."
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) return <div style={{ padding: 32, textAlign: "center", color: "#999" }}>Loading...</div>;
	if (!appointment) return <div style={{ padding: 32, textAlign: "center", color: "red" }}>Appointment not found.</div>;

	const patient = appointment.patient?.user;
	const doctor = appointment.doctor?.user;
	const allowedNextStatuses = ALLOWED_TRANSITIONS[appointment.status] ?? [];
	const isTerminal = allowedNextStatuses.length === 0;

	const timelineItems = history.map(h => ({
		color: STATUS_COLOR[h.newStatus] ?? "gray",
		children: (
			<div>
				<Tag color={STATUS_COLOR[h.newStatus]}>
					{h.previousStatus ? `${h.previousStatus} → ${h.newStatus}` : `Created as ${h.newStatus}`}
				</Tag>
				<br />
				<Text type="secondary" style={{ fontSize: 12 }}>
					{new Date(h.changedAt).toLocaleString("en-NL")}
					{h.changedByName ? ` · ${h.changedByName}` : ""}
					{h.changedByRole ? ` (${h.changedByRole})` : ""}
				</Text>
			</div>
		),
	}));

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
				Edit appointment
			</Title>

			<Card style={{ marginBottom: 16 }}>
				<p style={{ margin: 0, color: "#666", fontSize: 14 }}>
					<strong>Patient:</strong> {patient?.firstName} {patient?.lastName}
				</p>
				<p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
					<strong>Doctor:</strong> Dr. {doctor?.firstName} {doctor?.lastName}
				</p>
			</Card>

			<Card style={{ marginBottom: 16 }}>
				<Form
					form={form}
					layout="vertical"
					onFinish={values => {
						void onFinish(values as Record<string, unknown>);
					}}
				>
					<Form.Item name="status" label="Status" rules={[{ required: true }]}>
						<Select
							disabled={isTerminal}
							options={[
								{ value: appointment.status, label: `${appointment.status} (current)` },
								...allowedNextStatuses.map(s => ({ value: s, label: s })),
							]}
						/>
					</Form.Item>
					{isTerminal && (
						<p style={{ color: "#999", fontSize: 13, marginTop: -12, marginBottom: 16 }}>
							This appointment is in a terminal state and cannot be changed.
						</p>
					)}

					<Form.Item
						name="scheduledAt"
						label="Date & Time"
						rules={[{ required: true, message: "Pick a date and time" }]}
					>
						<DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} />
					</Form.Item>

					<Form.Item name="notes" label="Notes">
						<Input.TextArea rows={3} />
					</Form.Item>

					{!isTerminal && (
						<Form.Item style={{ marginBottom: 0 }}>
							<Button type="primary" htmlType="submit" loading={submitting} block>
								Save changes
							</Button>
						</Form.Item>
					)}
				</Form>
			</Card>

			{/* Status History */}
			<Card title="Status History">
				{history.length === 0 ? <Text type="secondary">No history recorded.</Text> : <Timeline items={timelineItems} />}
			</Card>
		</div>
	);
}
