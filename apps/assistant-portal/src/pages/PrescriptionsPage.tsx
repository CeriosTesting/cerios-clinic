import { Card, Select, Spin, Table, Typography } from "antd";
import React, { useEffect, useState } from "react";

import api from "../api";

const { Title, Text } = Typography;

interface SelectOption {
	value: string;
	label: string;
}

interface PrescriptionData {
	id: string;
	appointmentId: string;
	notes?: string | null;
	createdAt: string;
	items: Array<{
		id: string;
		medicationName: string;
		dosage: string;
		frequency: string;
		duration: string;
		instructions?: string | null;
	}>;
	patient?: { user?: { firstName: string; lastName: string; email: string } };
	doctor?: { user?: { firstName: string; lastName: string } };
	appointment?: { scheduledAt: string; status: string };
}

export default function PrescriptionsPage(): React.ReactElement {
	const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchType, setSearchType] = useState<"patient" | "doctor">("patient");
	const [patients, setPatients] = useState<SelectOption[]>([]);
	const [doctors, setDoctors] = useState<SelectOption[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

	const fetchPrescriptions = (endpoint: string): void => {
		setLoading(true);
		void api
			.get<{ data: PrescriptionData[] }>(endpoint)
			.then(r => setPrescriptions(r.data.data))
			.catch(() => setPrescriptions([]))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchPrescriptions("/prescriptions");
		void api
			.get<{ data: Array<{ id: string; user: { firstName: string; lastName: string; email: string } }> }>("/patients")
			.then(r =>
				setPatients(
					r.data.data.map(p => ({ value: p.id, label: `${p.user.firstName} ${p.user.lastName} (${p.user.email})` }))
				)
			);
		void api
			.get<{ data: Array<{ id: string; user: { firstName: string; lastName: string } }> }>("/patients/doctors")
			.then(r =>
				setDoctors(r.data.data.map(d => ({ value: d.id, label: `Dr. ${d.user.firstName} ${d.user.lastName}` })))
			);
	}, []);

	const handleSelect = (value: string | undefined): void => {
		setSelectedId(value);
		if (!value) {
			fetchPrescriptions("/prescriptions");
			return;
		}
		const endpoint = searchType === "patient" ? `/prescriptions/patient/${value}` : `/prescriptions/doctor/${value}`;
		fetchPrescriptions(endpoint);
	};

	const handleTypeChange = (type: "patient" | "doctor"): void => {
		setSearchType(type);
		setSelectedId(undefined);
		fetchPrescriptions("/prescriptions");
	};

	const columns = [
		{
			title: "Patient",
			key: "patient",
			render: (_: unknown, r: PrescriptionData) =>
				r.patient?.user ? `${r.patient.user.firstName} ${r.patient.user.lastName}` : "—",
		},
		{
			title: "Doctor",
			key: "doctor",
			render: (_: unknown, r: PrescriptionData) =>
				r.doctor?.user ? `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName}` : "—",
		},
		{
			title: "Date",
			key: "date",
			render: (_: unknown, r: PrescriptionData) =>
				new Date(r.appointment?.scheduledAt ?? r.createdAt).toLocaleDateString("en-NL", {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
		},
		{
			title: "Medications",
			dataIndex: "items",
			key: "items",
			render: (items: PrescriptionData["items"]) => items.length,
		},
	];

	return (
		<div>
			<Title level={3}>Prescriptions</Title>
			<Card style={{ marginBottom: 16 }}>
				<div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
					<button
						type="button"
						onClick={() => handleTypeChange("patient")}
						style={{
							padding: "4px 12px",
							borderRadius: 6,
							border: "1px solid #d9d9d9",
							background: searchType === "patient" ? "#E85A28" : "#fff",
							color: searchType === "patient" ? "#fff" : "#333",
							cursor: "pointer",
						}}
					>
						By Patient
					</button>
					<button
						type="button"
						onClick={() => handleTypeChange("doctor")}
						style={{
							padding: "4px 12px",
							borderRadius: 6,
							border: "1px solid #d9d9d9",
							background: searchType === "doctor" ? "#E85A28" : "#fff",
							color: searchType === "doctor" ? "#fff" : "#333",
							cursor: "pointer",
						}}
					>
						By Doctor
					</button>
				</div>
				<Select
					showSearch
					allowClear
					placeholder={`Select a ${searchType}...`}
					value={selectedId}
					onChange={handleSelect}
					options={searchType === "patient" ? patients : doctors}
					filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
					style={{ width: "100%" }}
					size="large"
				/>
			</Card>

			<Spin spinning={loading}>
				<Table
					dataSource={prescriptions}
					columns={columns}
					rowKey="id"
					expandable={{
						expandedRowRender: (record: PrescriptionData) => (
							<div>
								{record.notes && (
									<Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
										{record.notes}
									</Text>
								)}
								<Table
									dataSource={record.items}
									rowKey="id"
									size="small"
									pagination={false}
									columns={[
										{ title: "Medication", dataIndex: "medicationName", key: "name" },
										{ title: "Dosage", dataIndex: "dosage", key: "dosage" },
										{ title: "Frequency", dataIndex: "frequency", key: "frequency" },
										{ title: "Duration", dataIndex: "duration", key: "duration" },
										{
											title: "Instructions",
											dataIndex: "instructions",
											key: "instructions",
											render: (v: string | null) => v ?? "—",
										},
									]}
								/>
							</div>
						),
					}}
					locale={{ emptyText: "No prescriptions found" }}
				/>
			</Spin>
		</div>
	);
}
