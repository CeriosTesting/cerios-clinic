import type { Patient } from "@clinic/shared-types";
import React, { useEffect, useState } from "react";

import api from "../api";

interface ProfileData {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	patient: Pick<Patient, "dateOfBirth" | "phone" | "insuranceNumber" | "photo"> | null;
}

export default function ProfilePage(): React.ReactElement {
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		phone: "",
		dateOfBirth: "",
		insuranceNumber: "",
	});
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		void api
			.get<{ data: ProfileData }>("/profile")
			.then(r => {
				const p = r.data.data;
				setProfile(p);
				setForm({
					firstName: p.firstName,
					lastName: p.lastName,
					phone: p.patient?.phone ?? "",
					dateOfBirth: p.patient?.dateOfBirth ? new Date(p.patient.dateOfBirth).toISOString().split("T")[0] : "",
					insuranceNumber: p.patient?.insuranceNumber ?? "",
				});
			})
			.catch(() => {});
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setForm(f => ({ ...f, [e.target.name]: e.target.value }));
		setSuccess(false);
		setError("");
	};

	const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setSaving(true);
		setSuccess(false);
		setError("");
		try {
			await api.put("/profile", form);
			setSuccess(true);
		} catch {
			setError("Could not save profile. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	if (!profile) return <div className="text-center py-16 text-gray-400">Loading...</div>;

	return (
		<div className="max-w-xl mx-auto">
			<h1 className="text-2xl font-bold text-brand-navy mb-6">My Profile</h1>

			<div className="flex justify-center mb-6">
				<img
					src={profile.patient?.photo ?? "/placeholder-avatar.svg"}
					alt="Profile photo"
					style={{ width: 90, height: 120 }}
					className="rounded-lg object-cover border border-gray-200"
				/>
			</div>

			<div className="card mb-4">
				<p className="text-sm text-gray-400 mb-1">Email address</p>
				<p className="font-medium text-brand-navy">{profile.email}</p>
			</div>

			<form
				onSubmit={e => {
					void handleSubmit(e);
				}}
				className="card space-y-4"
			>
				<div className="grid grid-cols-2 gap-4">
					<Field label="First name" name="firstName" value={form.firstName} onChange={handleChange} />
					<Field label="Last name" name="lastName" value={form.lastName} onChange={handleChange} />
				</div>
				<Field label="Phone number" name="phone" value={form.phone} onChange={handleChange} type="tel" />
				<Field label="Date of birth" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} type="date" />
				<Field label="Insurance number" name="insuranceNumber" value={form.insuranceNumber} onChange={handleChange} />

				{success && <p className="text-green-600 text-sm font-medium">Profile saved successfully.</p>}
				{error && <p className="text-red-500 text-sm">{error}</p>}

				<button type="submit" className="btn-primary w-full" disabled={saving}>
					{saving ? "Saving..." : "Save changes"}
				</button>
			</form>
		</div>
	);
}

function Field({
	label,
	name,
	value,
	onChange,
	type = "text",
}: {
	label: string;
	name: string;
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	type?: string;
}): React.ReactElement {
	return (
		<div>
			<label className="block text-sm font-medium text-gray-600 mb-1" htmlFor={name}>
				{label}
			</label>
			<input
				id={name}
				name={name}
				type={type}
				value={value}
				onChange={onChange}
				className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
			/>
		</div>
	);
}
