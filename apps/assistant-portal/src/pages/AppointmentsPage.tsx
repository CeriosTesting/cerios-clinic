import type { Appointment } from "@clinic/shared-types";
import { Button, Card, Input, Popconfirm, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useCallback, useEffect, useState } from "react";
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

export default function AppointmentsPage(): React.ReactElement {
	const navigate = useNavigate();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	const load = useCallback(() => {
		setLoading(true);
		void api
			.get<{ data: Appointment[] }>("/appointments")
			.then(r => setAppointments(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const q = search.toLowerCase();
	const filtered = q
		? appointments.filter(a => {
				const patient = `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`.toLowerCase();
				const doctor = `${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`.toLowerCase();
				return patient.includes(q) || doctor.includes(q);
			})
		: appointments;

	const handleCancel = async (id: string): Promise<void> => {
		await api.delete(`/appointments/${id}`);
		load();
	};

	const columns: ColumnsType<Appointment> = [
		{
			title: "Date & Time",
			key: "scheduledAt",
			render: (_, a) => {
				const d = new Date(a.scheduledAt);
				return `${d.toLocaleDateString("en-NL")} ${d.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit" })}`;
			},
			sorter: (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
		},
		{
			title: "Patient",
			key: "patient",
			render: (_, a) => `${a.patient?.user?.firstName ?? ""} ${a.patient?.user?.lastName ?? ""}`,
			sorter: (a, b) => `${a.patient?.user?.lastName ?? ""}`.localeCompare(`${b.patient?.user?.lastName ?? ""}`),
		},
		{
			title: "Doctor",
			key: "doctor",
			render: (_, a) => `Dr. ${a.doctor?.user?.firstName ?? ""} ${a.doctor?.user?.lastName ?? ""}`,
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
			title: "Actions",
			key: "actions",
			render: (_, a) => (
				<div style={{ display: "flex", gap: 8 }}>
					<Button
						type="link"
						size="small"
						onClick={() => {
							void navigate(`/appointments/${a.id}/edit`);
						}}
					>
						Edit
					</Button>
					{a.status !== "CANCELLED" && a.status !== "COMPLETED" && (
						<Popconfirm
							title="Cancel this appointment?"
							onConfirm={() => {
								void handleCancel(a.id);
							}}
							okText="Yes"
							cancelText="No"
						>
							<Button type="link" size="small" danger>
								Cancel
							</Button>
						</Popconfirm>
					)}
				</div>
			),
		},
	];

	return (
		<div>
			<div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Title level={3} style={{ margin: 0, color: "#1A2238" }}>
					Appointments
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

			<Card style={{ marginBottom: 16 }}>
				<Search
					placeholder="Search patient or doctor"
					allowClear
					value={search}
					onChange={e => setSearch(e.target.value)}
					style={{ width: 280 }}
				/>
			</Card>

			<Card>
				<Table
					dataSource={filtered}
					columns={columns}
					rowKey="id"
					loading={loading}
					pagination={{ pageSize: 20 }}
					size="small"
				/>
			</Card>
		</div>
	);
}
