import type { Doctor, Assistant } from "@clinic/shared-types";
import React, { useCallback, useEffect, useState } from "react";

import api from "../api";

interface AdminUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	doctor?: Omit<Doctor, "user">;
	assistant?: Omit<Assistant, "user">;
}

type ModalMode = "none" | "create-doctor" | "edit-doctor" | "create-assistant" | "edit-assistant";

interface DoctorForm {
	firstName: string;
	lastName: string;
	email: string;
	specialization: string;
	licenseNumber: string;
	password: string;
}
interface AssistantForm {
	firstName: string;
	lastName: string;
	email: string;
	department: string;
	password: string;
}

const emptyDoctor = (): DoctorForm => ({
	firstName: "",
	lastName: "",
	email: "",
	specialization: "",
	licenseNumber: "",
	password: "",
});
const emptyAssistant = (): AssistantForm => ({ firstName: "", lastName: "", email: "", department: "", password: "" });

export default function AdminPage(): React.ReactElement {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<"doctors" | "assistants">("doctors");
	const [modal, setModal] = useState<ModalMode>("none");
	const [selected, setSelected] = useState<AdminUser | null>(null);
	const [doctorForm, setDoctorForm] = useState<DoctorForm>(emptyDoctor());
	const [assistantForm, setAssistantForm] = useState<AssistantForm>(emptyAssistant());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

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

	const openCreateDoctor = (): void => {
		setDoctorForm(emptyDoctor());
		setError("");
		setModal("create-doctor");
	};
	const openEditDoctor = (u: AdminUser): void => {
		setSelected(u);
		setDoctorForm({
			firstName: u.firstName,
			lastName: u.lastName,
			email: u.email,
			specialization: u.doctor?.specialization ?? "",
			licenseNumber: u.doctor?.licenseNumber ?? "",
			password: "",
		});
		setError("");
		setModal("edit-doctor");
	};
	const openCreateAssistant = (): void => {
		setAssistantForm(emptyAssistant());
		setError("");
		setModal("create-assistant");
	};
	const openEditAssistant = (u: AdminUser): void => {
		setSelected(u);
		setAssistantForm({
			firstName: u.firstName,
			lastName: u.lastName,
			email: u.email,
			department: u.assistant?.department ?? "",
			password: "",
		});
		setError("");
		setModal("edit-assistant");
	};
	const closeModal = (): void => {
		setModal("none");
		setSelected(null);
		setError("");
	};

	const submitDoctor = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSaving(true);
		setError("");
		try {
			if (modal === "create-doctor") {
				await api.post("/admin/doctors", doctorForm);
			} else {
				const { password: _pw, email: _em, ...update } = doctorForm;
				await api.put(`/admin/doctors/${selected!.doctor?.id}`, update);
			}
			closeModal();
			load();
		} catch {
			setError("Could not save. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	const submitAssistant = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSaving(true);
		setError("");
		try {
			if (modal === "create-assistant") {
				await api.post("/admin/assistants", assistantForm);
			} else {
				const { password: _pw, email: _em, ...update } = assistantForm;
				await api.put(`/admin/assistants/${selected!.assistant?.id}`, update);
			}
			closeModal();
			load();
		} catch {
			setError("Could not save. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (): Promise<void> => {
		if (!confirmDelete) return;
		setSaving(true);
		try {
			if (confirmDelete.role === "doctor") await api.delete(`/admin/doctors/${confirmDelete.doctor?.id}`);
			else await api.delete(`/admin/assistants/${confirmDelete.assistant?.id}`);
			setConfirmDelete(null);
			load();
		} catch {
			/* silent */
		} finally {
			setSaving(false);
		}
	};

	const renderModals = (): React.ReactElement | null => {
		if (modal === "create-doctor" || modal === "edit-doctor") {
			return (
				<Modal title={modal === "create-doctor" ? "Add doctor" : "Edit doctor"} onClose={closeModal}>
					<form
						onSubmit={e => {
							void submitDoctor(e);
						}}
						className="space-y-4"
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Field
								label="First name"
								value={doctorForm.firstName}
								onChange={v => setDoctorForm(f => ({ ...f, firstName: v }))}
								required
							/>
							<Field
								label="Last name"
								value={doctorForm.lastName}
								onChange={v => setDoctorForm(f => ({ ...f, lastName: v }))}
								required
							/>
						</div>
						<Field
							label="Email"
							type="email"
							value={doctorForm.email}
							onChange={v => setDoctorForm(f => ({ ...f, email: v }))}
							required
							disabled={modal === "edit-doctor"}
						/>
						{modal === "create-doctor" && (
							<Field
								label="Password"
								type="password"
								value={doctorForm.password}
								onChange={v => setDoctorForm(f => ({ ...f, password: v }))}
								required
							/>
						)}
						<Field
							label="Specialization"
							value={doctorForm.specialization}
							onChange={v => setDoctorForm(f => ({ ...f, specialization: v }))}
						/>
						<Field
							label="License number"
							value={doctorForm.licenseNumber}
							onChange={v => setDoctorForm(f => ({ ...f, licenseNumber: v }))}
						/>
						{error && <p className="text-red-500 text-sm">{error}</p>}
						<div className="flex gap-3 justify-end pt-2">
							<button type="button" onClick={closeModal} className="btn-ghost">
								Cancel
							</button>
							<button type="submit" className="btn-primary" disabled={saving}>
								{saving ? "Saving..." : "Save"}
							</button>
						</div>
					</form>
				</Modal>
			);
		}
		if (modal === "create-assistant" || modal === "edit-assistant") {
			return (
				<Modal title={modal === "create-assistant" ? "Add assistant" : "Edit assistant"} onClose={closeModal}>
					<form
						onSubmit={e => {
							void submitAssistant(e);
						}}
						className="space-y-4"
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Field
								label="First name"
								value={assistantForm.firstName}
								onChange={v => setAssistantForm(f => ({ ...f, firstName: v }))}
								required
							/>
							<Field
								label="Last name"
								value={assistantForm.lastName}
								onChange={v => setAssistantForm(f => ({ ...f, lastName: v }))}
								required
							/>
						</div>
						<Field
							label="Email"
							type="email"
							value={assistantForm.email}
							onChange={v => setAssistantForm(f => ({ ...f, email: v }))}
							required
							disabled={modal === "edit-assistant"}
						/>
						{modal === "create-assistant" && (
							<Field
								label="Password"
								type="password"
								value={assistantForm.password}
								onChange={v => setAssistantForm(f => ({ ...f, password: v }))}
								required
							/>
						)}
						<Field
							label="Department"
							value={assistantForm.department}
							onChange={v => setAssistantForm(f => ({ ...f, department: v }))}
						/>
						{error && <p className="text-red-500 text-sm">{error}</p>}
						<div className="flex gap-3 justify-end pt-2">
							<button type="button" onClick={closeModal} className="btn-ghost">
								Cancel
							</button>
							<button type="submit" className="btn-primary" disabled={saving}>
								{saving ? "Saving..." : "Save"}
							</button>
						</div>
					</form>
				</Modal>
			);
		}
		if (confirmDelete) {
			return (
				<Modal title="Confirm deletion" onClose={() => setConfirmDelete(null)}>
					<p className="text-sm text-gray-600 mb-6">
						Are you sure you want to remove{" "}
						<strong>
							{confirmDelete.firstName} {confirmDelete.lastName}
						</strong>
						? Their account will be disabled and they will no longer be able to log in.
					</p>
					<div className="flex gap-3 justify-end">
						<button onClick={() => setConfirmDelete(null)} className="btn-ghost">
							Cancel
						</button>
						<button
							onClick={() => {
								void handleDelete();
							}}
							disabled={saving}
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 text-white font-semibold px-4 py-2 text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
						>
							{saving ? "Deleting..." : "Delete"}
						</button>
					</div>
				</Modal>
			);
		}
		return null;
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-brand-navy">User Management</h1>
				<button className="btn-primary" onClick={tab === "doctors" ? openCreateDoctor : openCreateAssistant}>
					+ Add {tab === "doctors" ? "doctor" : "assistant"}
				</button>
			</div>

			<div className="flex gap-2 mb-6">
				{(["doctors", "assistants"] as const).map(t => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
							tab === t
								? "bg-brand-navy text-white"
								: "bg-white border border-gray-200 text-gray-500 hover:border-brand-navy"
						}`}
					>
						{t} ({t === "doctors" ? doctors.length : assistants.length})
					</button>
				))}
			</div>

			{loading && <p className="text-gray-400">Loading...</p>}

			{!loading && (
				<div className="card overflow-hidden p-0">
					<div className="overflow-x-auto">
						<table className="w-full text-sm min-w-[500px]">
							<thead className="bg-gray-50 border-b border-gray-100">
								<tr>
									<th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Name</th>
									<th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Email</th>
									<th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
										{tab === "doctors" ? "Specialization" : "Department"}
									</th>
									<th className="px-4 py-3"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{(tab === "doctors" ? doctors : assistants).map(u => (
									<tr key={u.id} className="hover:bg-gray-50 transition-colors">
										<td className="px-4 py-3 font-medium text-brand-navy">
											{u.firstName} {u.lastName}
										</td>
										<td className="px-4 py-3 text-gray-500">{u.email}</td>
										<td className="px-4 py-3 text-gray-500">
											{tab === "doctors" ? u.doctor?.specialization : u.assistant?.department}
										</td>
										<td className="px-4 py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={() => (tab === "doctors" ? openEditDoctor(u) : openEditAssistant(u))}
													className="text-brand-orange text-xs font-medium hover:underline"
												>
													Edit
												</button>
												<button
													onClick={() => setConfirmDelete(u)}
													className="text-red-400 text-xs font-medium hover:underline"
												>
													Delete
												</button>
											</div>
										</td>
									</tr>
								))}
								{(tab === "doctors" ? doctors : assistants).length === 0 && (
									<tr>
										<td colSpan={4} className="px-4 py-8 text-center text-gray-400">
											No {tab} found.
										</td>
									</tr>
								)}
							</tbody>
						</table>{" "}
					</div>{" "}
				</div>
			)}

			{renderModals()}
		</div>
	);
}

function Modal({
	title,
	children,
	onClose,
}: {
	title: string;
	children: React.ReactNode;
	onClose: () => void;
}): React.ReactElement {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-lg font-bold text-brand-navy">{title}</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
						&times;
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	type = "text",
	required,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: string;
	required?: boolean;
	disabled?: boolean;
}): React.ReactElement {
	return (
		<div>
			<label className="form-label">{label}</label>
			<input
				type={type}
				value={value}
				onChange={e => onChange(e.target.value)}
				required={required}
				disabled={disabled}
				className="form-input disabled:bg-gray-50 disabled:text-gray-400"
			/>
		</div>
	);
}
