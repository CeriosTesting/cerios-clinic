import type { Appointment } from "@clinic/shared-types";
import { Card, Row, Col, Statistic, Table, Tag, Button, Typography, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

const { Title } = Typography;
const { Search } = Input;

const STATUS_COLOR: Record<string, string> = {
	SCHEDULED: "blue",
	CONFIRMED: "green",
	COMPLETED: "default",
	CANCELLED: "red",
};

export default function DashboardPage(): React.ReactElement {
	const navigate = useNavigate();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	useEffect(() => {
		const today = new Date();
		const from = new Date(today.setHours(0, 0, 0, 0)).toISOString();
		const to = new Date(today.setHours(23, 59, 59, 999)).toISOString();
		void api
			.get<{ data: Appointment[] }>("/appointments", { params: { from, to } })
			.then(r => setAppointments(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const q = search.toLowerCase();
	const filtered = q
		? appointments.filter(a => {
				const patient = `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`.toLowerCase();
				const doctor = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
				return patient.includes(q) || doctor.includes(q);
			})
		: appointments;

	const scheduled = appointments.filter(a => a.status === "SCHEDULED").length;
	const confirmed = appointments.filter(a => a.status === "CONFIRMED").length;

	const columns: ColumnsType<Appointment> = [
		{
			title: "Time",
			key: "time",
			render: (_, a) => new Date(a.scheduledAt).toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" }),
			width: 80,
			sorter: (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
			defaultSortOrder: "ascend",
		},
		{
			title: "Patient",
			key: "patient",
			render: (_, a) => `${a.patient?.user?.firstName} ${a.patient?.user?.lastName}`,
			sorter: (a, b) => `${a.patient?.user?.lastName ?? ""}`.localeCompare(`${b.patient?.user?.lastName ?? ""}`),
		},
		{
			title: "Doctor",
			key: "doctor",
			render: (_, a) => `Dr. ${a.doctor?.user?.firstName} ${a.doctor?.user?.lastName}`,
			sorter: (a, b) => `${a.doctor?.user?.lastName ?? ""}`.localeCompare(`${b.doctor?.user?.lastName ?? ""}`),
		},
		{
			title: "Status",
			key: "status",
			render: (_, a) => <Tag color={STATUS_COLOR[a.status]}>{a.status}</Tag>,
			filters: [
				{ text: "Scheduled", value: "SCHEDULED" },
				{ text: "Confirmed", value: "CONFIRMED" },
				{ text: "Completed", value: "COMPLETED" },
				{ text: "Cancelled", value: "CANCELLED" },
			],
			onFilter: (value, a) => a.status === value,
		},
		{
			title: "",
			key: "action",
			render: (_, a) => (
				<Button
					type="link"
					size="small"
					onClick={() => {
						void navigate(`/appointments/${a.id}/edit`);
					}}
				>
					Edit
				</Button>
			),
		},
	];

	return (
		<div>
			<div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Title level={3} style={{ margin: 0, color: "#1A2238" }}>
					Dashboard
				</Title>
				<Button
					type="primary"
					onClick={() => {
						void navigate("/appointments/create");
					}}
				>
					+ New appointment
				</Button>
			</div>

			<Row gutter={16} style={{ marginBottom: 24 }}>
				<Col span={8}>
					<Card>
						<Statistic title="Today's total" value={appointments.length} styles={{ content: { color: "#E85A28" } }} />
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic title="Scheduled" value={scheduled} styles={{ content: { color: "#1677ff" } }} />
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic title="Confirmed" value={confirmed} styles={{ content: { color: "#52c41a" } }} />
					</Card>
				</Col>
			</Row>

			<Card title="Today's schedule">
				<Search
					placeholder="Search patient or doctor"
					allowClear
					value={search}
					onChange={e => setSearch(e.target.value)}
					style={{ maxWidth: 320, marginBottom: 16 }}
				/>
				<Table dataSource={filtered} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" />
			</Card>
		</div>
	);
}
