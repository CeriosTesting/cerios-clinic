import { Card, Rate, Select, Spin, Table, Typography } from "antd";
import React, { useEffect, useState } from "react";

import api from "../api";

const { Title, Text } = Typography;

interface SelectOption {
	value: string;
	label: string;
}

interface ReviewData {
	id: string;
	rating: number;
	comment?: string | null;
	createdAt: string;
	patient?: { user?: { firstName: string; lastName: string } };
	doctor?: { user?: { firstName: string; lastName: string } };
	appointment?: { scheduledAt: string };
}

interface ReviewStats {
	averageRating: number;
	totalReviews: number;
}

export default function ReviewsPage(): React.ReactElement {
	const [reviews, setReviews] = useState<ReviewData[]>([]);
	const [stats, setStats] = useState<ReviewStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [searchType, setSearchType] = useState<"doctor" | "patient">("doctor");
	const [patients, setPatients] = useState<SelectOption[]>([]);
	const [doctors, setDoctors] = useState<SelectOption[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

	const fetchReviews = (endpoint: string): void => {
		setLoading(true);
		void api
			.get<{ data: ReviewData[]; stats?: ReviewStats }>(endpoint)
			.then(r => {
				setReviews(r.data.data);
				setStats(r.data.stats ?? null);
			})
			.catch(() => {
				setReviews([]);
				setStats(null);
			})
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchReviews("/reviews");
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
			fetchReviews("/reviews");
			return;
		}
		const endpoint = `/reviews/${searchType}/${value}`;
		fetchReviews(endpoint);
	};

	const handleTypeChange = (type: "doctor" | "patient"): void => {
		setSearchType(type);
		setSelectedId(undefined);
		fetchReviews("/reviews");
	};

	const columns = [
		{
			title: "Patient",
			key: "patient",
			render: (_: unknown, r: ReviewData) =>
				r.patient?.user ? `${r.patient.user.firstName} ${r.patient.user.lastName}` : "—",
		},
		{
			title: "Rating",
			key: "rating",
			render: (_: unknown, r: ReviewData) => <Rate disabled value={r.rating} style={{ fontSize: 14 }} />,
		},
		{
			title: "Comment",
			dataIndex: "comment",
			key: "comment",
			render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
		},
		{
			title: "Date",
			key: "date",
			render: (_: unknown, r: ReviewData) =>
				new Date(r.appointment?.scheduledAt ?? r.createdAt).toLocaleDateString("en-NL", {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
		},
	];

	return (
		<div>
			<Title level={3}>Reviews</Title>

			<Card style={{ marginBottom: 16 }}>
				<div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
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
				</div>
				<Select
					showSearch
					allowClear
					placeholder={`Select a ${searchType}...`}
					value={selectedId}
					onChange={handleSelect}
					options={searchType === "doctor" ? doctors : patients}
					filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
					style={{ width: "100%" }}
					size="large"
				/>
			</Card>

			{stats && (
				<div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
					<Card style={{ flex: 1, textAlign: "center" }}>
						<Title level={2} style={{ margin: 0 }}>
							{stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
						</Title>
						<Text type="secondary">Average rating</Text>
						{stats.averageRating > 0 && (
							<div>
								<Rate disabled value={Math.round(stats.averageRating)} style={{ fontSize: 16 }} />
							</div>
						)}
					</Card>
					<Card style={{ flex: 1, textAlign: "center" }}>
						<Title level={2} style={{ margin: 0 }}>
							{stats.totalReviews}
						</Title>
						<Text type="secondary">Total reviews</Text>
					</Card>
				</div>
			)}

			<Spin spinning={loading}>
				<Table dataSource={reviews} columns={columns} rowKey="id" locale={{ emptyText: "No reviews found" }} />
			</Spin>
		</div>
	);
}
