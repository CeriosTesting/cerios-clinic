import { Button, Card, Input, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

const { Title } = Typography;
const { Search } = Input;

interface PatientRow {
	id: string;
	userId: string;
	photo?: string | null;
	phone?: string | null;
	dateOfBirth?: string | null;
	user: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
	};
}

export default function PatientsPage(): React.ReactElement {
	const navigate = useNavigate();
	const [patients, setPatients] = useState<PatientRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");

	const search = useCallback((q: string) => {
		setQuery(q);
		setLoading(true);
		void api
			.get<{ data: PatientRow[] }>("/patients", { params: q ? { q } : undefined })
			.then(r => setPatients(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		search("");
	}, [search]);

	const columns: ColumnsType<PatientRow> = [
		{
			title: "",
			key: "photo",
			width: 56,
			render: (_, p) => (
				<img
					src={p.photo ?? "/placeholder-avatar.svg"}
					alt=""
					style={{
						width: 36,
						height: 48,
						objectFit: "cover",
						borderRadius: 4,
						border: "1px solid #E8EDF2",
						display: "block",
					}}
				/>
			),
		},
		{
			title: "Name",
			key: "name",
			render: (_, p) => `${p.user.firstName} ${p.user.lastName}`,
			sorter: (a, b) => a.user.lastName.localeCompare(b.user.lastName),
			defaultSortOrder: "ascend",
		},
		{
			title: "Email",
			key: "email",
			render: (_, p) => p.user.email,
		},
		{
			title: "Phone",
			key: "phone",
			render: (_, p) => p.phone ?? "—",
		},
		{
			title: "",
			key: "action",
			render: (_, p) => (
				<Button
					type="link"
					size="small"
					style={{ color: "#E85A28" }}
					onClick={() => {
						void navigate(`/patients/${p.userId}`);
					}}
				>
					View
				</Button>
			),
		},
	];

	return (
		<div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
				<Title level={3} style={{ color: "#1A2238", margin: 0 }}>
					Patients
				</Title>
			</div>
			<Card>
				<Search
					id="patients-search"
					placeholder="Search by name or email"
					allowClear
					value={query}
					style={{ maxWidth: 360, marginBottom: 16 }}
					onSearch={search}
					onChange={e => {
						if (!e.target.value) search("");
						else setQuery(e.target.value);
					}}
				/>
				<Table
					dataSource={patients}
					columns={columns}
					rowKey="id"
					loading={loading}
					pagination={{ pageSize: 20, showSizeChanger: false }}
					onRow={(p): React.HTMLAttributes<HTMLElement> => ({
						onClick: (): void => {
							void navigate(`/patients/${p.userId}`);
						},
						style: { cursor: "pointer" },
					})}
				/>
			</Card>
		</div>
	);
}
