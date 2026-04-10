import { Button, Card, Form, Input, Modal, Popconfirm, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useCallback, useEffect, useState } from "react";

import api from "../api";

const { Title } = Typography;

interface AdminUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	doctor?: { id: string; specialization: string; licenseNumber: string };
	assistant?: { id: string; department: string };
}

export default function AdminPage(): React.ReactElement {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState("doctors");

	// Modal state
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create-doctor" | "edit-doctor" | "create-assistant" | "edit-assistant">(
		"create-doctor"
	);
	const [selected, setSelected] = useState<AdminUser | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();

	const load = useCallback(() => {
		setLoading(true);
		void api
			.get<{ data: AdminUser[] }>("/admin/users")
			.then(r => setUsers(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const doctors = users.filter(u => u.role === "doctor");
	const assistants = users.filter(u => u.role === "assistant");

	const openCreate = (type: "doctor" | "assistant"): void => {
		setSelected(null);
		form.resetFields();
		setModalMode(type === "doctor" ? "create-doctor" : "create-assistant");
		setModalOpen(true);
	};

	const openEdit = (u: AdminUser): void => {
		setSelected(u);
		if (u.role === "doctor") {
			form.setFieldsValue({
				firstName: u.firstName,
				lastName: u.lastName,
				email: u.email,
				specialization: u.doctor?.specialization,
				licenseNumber: u.doctor?.licenseNumber,
			});
			setModalMode("edit-doctor");
		} else {
			form.setFieldsValue({
				firstName: u.firstName,
				lastName: u.lastName,
				email: u.email,
				department: u.assistant?.department,
			});
			setModalMode("edit-assistant");
		}
		setModalOpen(true);
	};

	const handleDelete = async (u: AdminUser): Promise<void> => {
		try {
			if (u.role === "doctor") await api.delete(`/admin/doctors/${u.doctor?.id}`);
			else await api.delete(`/admin/assistants/${u.assistant?.id}`);
			message.success("User removed.");
			load();
		} catch {
			message.error("Could not remove user.");
		}
	};

	const handleSubmit = async (): Promise<void> => {
		const values = await form.validateFields();
		setSaving(true);
		try {
			if (modalMode === "create-doctor") await api.post("/admin/doctors", values);
			else if (modalMode === "edit-doctor") await api.put(`/admin/doctors/${selected!.doctor?.id}`, values);
			else if (modalMode === "create-assistant") await api.post("/admin/assistants", values);
			else await api.put(`/admin/assistants/${selected!.assistant?.id}`, values);
			message.success("Saved!");
			setModalOpen(false);
			load();
		} catch {
			message.error("Could not save.");
		} finally {
			setSaving(false);
		}
	};

	const isDoctor = modalMode.includes("doctor");
	const isEdit = modalMode.startsWith("edit");

	const doctorColumns: ColumnsType<AdminUser> = [
		{ title: "Name", render: (_, u) => `${u.firstName} ${u.lastName}` },
		{ title: "Email", dataIndex: "email" },
		{ title: "Specialization", render: (_, u) => u.doctor?.specialization ?? "—" },
		{
			title: "Actions",
			render: (_, u) => (
				<div style={{ display: "flex", gap: 8 }}>
					<Button type="link" size="small" onClick={() => openEdit(u)}>
						Edit
					</Button>
					<Popconfirm
						title="Remove this doctor?"
						onConfirm={() => {
							void handleDelete(u);
						}}
						okText="Yes"
						cancelText="No"
					>
						<Button type="link" size="small" danger>
							Delete
						</Button>
					</Popconfirm>
				</div>
			),
		},
	];

	const assistantColumns: ColumnsType<AdminUser> = [
		{ title: "Name", render: (_, u) => `${u.firstName} ${u.lastName}` },
		{ title: "Email", dataIndex: "email" },
		{ title: "Department", render: (_, u) => u.assistant?.department ?? "—" },
		{
			title: "Actions",
			render: (_, u) => (
				<div style={{ display: "flex", gap: 8 }}>
					<Button type="link" size="small" onClick={() => openEdit(u)}>
						Edit
					</Button>
					<Popconfirm
						title="Remove this assistant?"
						onConfirm={() => {
							void handleDelete(u);
						}}
						okText="Yes"
						cancelText="No"
					>
						<Button type="link" size="small" danger>
							Delete
						</Button>
					</Popconfirm>
				</div>
			),
		},
	];

	const tabItems = [
		{
			key: "doctors",
			label: `Doctors (${doctors.length})`,
			children: (
				<Table
					dataSource={doctors}
					columns={doctorColumns}
					rowKey="id"
					loading={loading}
					size="small"
					pagination={{ pageSize: 15 }}
				/>
			),
		},
		{
			key: "assistants",
			label: `Assistants (${assistants.length})`,
			children: (
				<Table
					dataSource={assistants}
					columns={assistantColumns}
					rowKey="id"
					loading={loading}
					size="small"
					pagination={{ pageSize: 15 }}
				/>
			),
		},
	];

	return (
		<div>
			<div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Title level={3} style={{ margin: 0, color: "#1A2238" }}>
					Admin — User Management
				</Title>
				<Button type="primary" onClick={() => openCreate(tab === "doctors" ? "doctor" : "assistant")}>
					+ Add {tab === "doctors" ? "doctor" : "assistant"}
				</Button>
			</div>

			<Card>
				<Tabs activeKey={tab} onChange={setTab} items={tabItems} />
			</Card>

			<Modal
				open={modalOpen}
				title={`${isEdit ? "Edit" : "Add"} ${isDoctor ? "doctor" : "assistant"}`}
				onCancel={() => setModalOpen(false)}
				onOk={() => {
					void handleSubmit();
				}}
				okText={saving ? "Saving..." : "Save"}
				confirmLoading={saving}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" style={{ marginTop: 16 }}>
					<Form.Item name="firstName" label="First name" rules={[{ required: true }]}>
						<Input />
					</Form.Item>
					<Form.Item name="lastName" label="Last name" rules={[{ required: true }]}>
						<Input />
					</Form.Item>
					<Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
						<Input disabled={isEdit} />
					</Form.Item>
					{isDoctor ? (
						<>
							<Form.Item name="specialization" label="Specialization" rules={[{ required: true }]}>
								<Input />
							</Form.Item>
							<Form.Item name="licenseNumber" label="License number" rules={[{ required: true }]}>
								<Input />
							</Form.Item>
						</>
					) : (
						<Form.Item name="department" label="Department" rules={[{ required: true }]}>
							<Input />
						</Form.Item>
					)}
				</Form>
			</Modal>
		</div>
	);
}
