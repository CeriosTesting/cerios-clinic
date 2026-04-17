import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import api from "../api";

interface AdminUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	doctor?: { id: string; specialization: string; licenseNumber: string };
	assistant?: { id: string; department: string };
}

interface FormValues {
	firstName: string;
	lastName: string;
	email: string;
	specialization?: string;
	licenseNumber?: string;
	department?: string;
}

export default function AdminPage(): React.ReactElement {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<"doctors" | "assistants">("doctors");

	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create-doctor" | "edit-doctor" | "create-assistant" | "edit-assistant">(
		"create-doctor"
	);
	const [selected, setSelected] = useState<AdminUser | null>(null);
	const [saving, setSaving] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const {
		register,
		handleSubmit: rhfSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>();

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
		reset({ firstName: "", lastName: "", email: "", specialization: "", licenseNumber: "", department: "" });
		setModalMode(type === "doctor" ? "create-doctor" : "create-assistant");
		setModalOpen(true);
	};

	const openEdit = (u: AdminUser): void => {
		setSelected(u);
		if (u.role === "doctor") {
			reset({
				firstName: u.firstName,
				lastName: u.lastName,
				email: u.email,
				specialization: u.doctor?.specialization,
				licenseNumber: u.doctor?.licenseNumber,
			});
			setModalMode("edit-doctor");
		} else {
			reset({
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
			toast.success("User removed.");
			setDeleteConfirm(null);
			load();
		} catch {
			toast.error("Could not remove user.");
		}
	};

	const onModalSubmit = async (values: FormValues): Promise<void> => {
		setSaving(true);
		try {
			if (modalMode === "create-doctor") await api.post("/admin/doctors", values);
			else if (modalMode === "edit-doctor") await api.put(`/admin/doctors/${selected!.doctor?.id}`, values);
			else if (modalMode === "create-assistant") await api.post("/admin/assistants", values);
			else await api.put(`/admin/assistants/${selected!.assistant?.id}`, values);
			toast.success("Saved!");
			setModalOpen(false);
			load();
		} catch {
			toast.error("Could not save.");
		} finally {
			setSaving(false);
		}
	};

	const isDoctor = modalMode.includes("doctor");
	const isEdit = modalMode.startsWith("edit");

	const renderTable = (data: AdminUser[], type: "doctor" | "assistant"): React.ReactElement => (
		<div className="overflow-x-auto">
			{loading && <p className="text-gray-400 text-sm">Loading...</p>}
			{!loading && data.length === 0 && <p className="text-gray-400 text-sm">No {type}s found.</p>}
			{!loading && data.length > 0 && (
				<table className="w-full text-sm min-w-[500px]">
					<thead className="border-b border-gray-100">
						<tr>
							<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Name</th>
							<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Email</th>
							<th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
								{type === "doctor" ? "Specialization" : "Department"}
							</th>
							<th className="px-3 py-2 w-36"></th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-50">
						{data.map(u => (
							<tr key={u.id} className="hover:bg-gray-50 transition-colors">
								<td className="px-3 py-2 font-medium text-brand-navy">
									{u.firstName} {u.lastName}
								</td>
								<td className="px-3 py-2 text-gray-600">{u.email}</td>
								<td className="px-3 py-2 text-gray-500">
									{type === "doctor" ? (u.doctor?.specialization ?? "—") : (u.assistant?.department ?? "—")}
								</td>
								<td className="px-3 py-2">
									<div className="flex gap-2 items-center relative">
										<button className="btn-link" onClick={() => openEdit(u)}>
											Edit
										</button>
										<button className="btn-link-danger" onClick={() => setDeleteConfirm(u.id)}>
											Delete
										</button>
										{deleteConfirm === u.id && (
											<div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-[180px]">
												<p className="text-sm text-gray-600 mb-2">Remove this {type}?</p>
												<div className="flex gap-2 justify-end">
													<button className="btn-ghost text-xs" onClick={() => setDeleteConfirm(null)}>
														No
													</button>
													<button
														className="btn-primary text-xs"
														onClick={() => {
															void handleDelete(u);
														}}
													>
														Yes
													</button>
												</div>
											</div>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);

	return (
		<div>
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<h1 className="text-2xl font-bold text-brand-navy">Admin — User Management</h1>
				<button className="btn-primary" onClick={() => openCreate(tab === "doctors" ? "doctor" : "assistant")}>
					+ Add {tab === "doctors" ? "doctor" : "assistant"}
				</button>
			</div>

			<div className="card">
				<div className="flex gap-1 border-b border-gray-200 mb-4">
					<button
						className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
							tab === "doctors"
								? "border-brand-primary text-brand-primary"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}
						onClick={() => setTab("doctors")}
					>
						Doctors ({doctors.length})
					</button>
					<button
						className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
							tab === "assistants"
								? "border-brand-primary text-brand-primary"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}
						onClick={() => setTab("assistants")}
					>
						Assistants ({assistants.length})
					</button>
				</div>
				{tab === "doctors" ? renderTable(doctors, "doctor") : renderTable(assistants, "assistant")}
			</div>

			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setModalOpen(false)}>
					<div className="absolute inset-0 bg-black/30" />
					<div
						className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
						onClick={e => e.stopPropagation()}
					>
						<h2 className="text-lg font-bold text-brand-navy mb-4">
							{isEdit ? "Edit" : "Add"} {isDoctor ? "doctor" : "assistant"}
						</h2>
						<form
							onSubmit={e => {
								void rhfSubmit(onModalSubmit)(e);
							}}
							className="space-y-3"
						>
							<div>
								<label className="form-label">First name</label>
								<input {...register("firstName", { required: "Required" })} className="form-input w-full" />
								{errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
							</div>
							<div>
								<label className="form-label">Last name</label>
								<input {...register("lastName", { required: "Required" })} className="form-input w-full" />
								{errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
							</div>
							<div>
								<label className="form-label">Email</label>
								<input
									{...register("email", {
										required: "Required",
										pattern: { value: /^\S+@\S+$/i, message: "Invalid email" },
									})}
									disabled={isEdit}
									className="form-input w-full disabled:opacity-50"
								/>
								{errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
							</div>
							{isDoctor ? (
								<>
									<div>
										<label className="form-label">Specialization</label>
										<input {...register("specialization", { required: "Required" })} className="form-input w-full" />
										{errors.specialization && (
											<p className="text-red-500 text-xs mt-1">{errors.specialization.message}</p>
										)}
									</div>
									<div>
										<label className="form-label">License number</label>
										<input {...register("licenseNumber", { required: "Required" })} className="form-input w-full" />
										{errors.licenseNumber && (
											<p className="text-red-500 text-xs mt-1">{errors.licenseNumber.message}</p>
										)}
									</div>
								</>
							) : (
								<div>
									<label className="form-label">Department</label>
									<input {...register("department", { required: "Required" })} className="form-input w-full" />
									{errors.department && <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>}
								</div>
							)}

							<div className="flex gap-2 justify-end pt-2">
								<button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
									Cancel
								</button>
								<button type="submit" className="btn-primary" disabled={saving}>
									{saving ? "Saving..." : "Save"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
