import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useProfile, useUpdateProfile } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";

function formatDob(date?: string | null): string {
	if (!date) return "";
	return new Date(date).toISOString().split("T")[0];
}

type FormValues = {
	firstName: string;
	lastName: string;
	phone: string;
	dateOfBirth: string;
	insuranceNumber: string;
};

type FieldHandlers = {
	firstName: (v: string) => void;
	lastName: (v: string) => void;
	phone: (v: string) => void;
	dateOfBirth: (v: string) => void;
	insuranceNumber: (v: string) => void;
};

function ProfileFormContent({
	profile,
	form,
	update,
	handlers,
	onSave,
	onSignOut,
}: {
	profile: ReturnType<typeof useProfile>["data"];
	form: FormValues;
	update: ReturnType<typeof useUpdateProfile>;
	handlers: FieldHandlers;
	onSave: () => void;
	onSignOut: () => void;
}): React.JSX.Element {
	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			{/* Email (read-only) */}
			<View style={styles.emailCard}>
				<Text style={styles.emailLabel}>Email address</Text>
				<Text style={styles.emailValue}>{profile?.email ?? ""}</Text>
			</View>

			<View style={styles.card}>
				<FormRow label="First name">
					<TextInput
						style={styles.input}
						value={form.firstName}
						onChangeText={handlers.firstName}
						autoCapitalize="words"
					/>
				</FormRow>
				<FormRow label="Last name">
					<TextInput
						style={styles.input}
						value={form.lastName}
						onChangeText={handlers.lastName}
						autoCapitalize="words"
					/>
				</FormRow>
				<FormRow label="Phone number">
					<TextInput style={styles.input} value={form.phone} onChangeText={handlers.phone} keyboardType="phone-pad" />
				</FormRow>
				<FormRow label="Date of birth">
					<TextInput
						style={styles.input}
						value={form.dateOfBirth}
						onChangeText={handlers.dateOfBirth}
						placeholder="YYYY-MM-DD"
						placeholderTextColor="#D1D5DB"
					/>
				</FormRow>
				<FormRow label="Insurance number" last>
					<TextInput style={styles.input} value={form.insuranceNumber} onChangeText={handlers.insuranceNumber} />
				</FormRow>
			</View>

			{update.isSuccess ? <Text style={styles.success}>Profile saved successfully.</Text> : null}
			{update.isError ? <Text style={styles.error}>Could not save profile. Please try again.</Text> : null}

			<TouchableOpacity
				style={[styles.saveBtn, update.isPending && styles.saveBtnDisabled]}
				onPress={onSave}
				disabled={update.isPending}
			>
				{update.isPending ? (
					<ActivityIndicator color="#ffffff" />
				) : (
					<Text style={styles.saveBtnText}>Save Changes</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
				<Text style={styles.signOutBtnText}>Sign Out</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

export default function ProfileScreen(): React.JSX.Element {
	const { data: profile, isLoading } = useProfile();
	const update = useUpdateProfile();
	const { logout } = useAuth();

	// Lazy initial state: populated from the first non-null profile response
	const [form, setForm] = useState<FormValues>({
		firstName: profile?.firstName ?? "",
		lastName: profile?.lastName ?? "",
		phone: profile?.patient?.phone ?? "",
		dateOfBirth: formatDob(profile?.patient?.dateOfBirth),
		insuranceNumber: profile?.patient?.insuranceNumber ?? "",
	});

	// Sync when the profile loads (won't fire again if already populated)
	useEffect(() => {
		if (!profile) return;
		setForm({
			firstName: profile.firstName,
			lastName: profile.lastName,
			phone: profile.patient?.phone ?? "",
			dateOfBirth: formatDob(profile.patient?.dateOfBirth),
			insuranceNumber: profile.patient?.insuranceNumber ?? "",
		});
	}, [profile]);

	// Stable handlers — one per field to avoid building a new closure per keystroke
	const setFirstName = useCallback((v: string) => setForm(f => ({ ...f, firstName: v })), []);
	const setLastName = useCallback((v: string) => setForm(f => ({ ...f, lastName: v })), []);
	const setPhone = useCallback((v: string) => setForm(f => ({ ...f, phone: v })), []);
	const setDateOfBirth = useCallback((v: string) => setForm(f => ({ ...f, dateOfBirth: v })), []);
	const setInsuranceNumber = useCallback((v: string) => setForm(f => ({ ...f, insuranceNumber: v })), []);

	const handleSave = useCallback((): void => {
		update.mutate(form);
	}, [update, form]);

	const handleSignOut = useCallback((): void => {
		void logout();
	}, [logout]);

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color="#1A2238" />
			</View>
		);
	}

	return (
		<ProfileFormContent
			profile={profile}
			form={form}
			update={update}
			handlers={{
				firstName: setFirstName,
				lastName: setLastName,
				phone: setPhone,
				dateOfBirth: setDateOfBirth,
				insuranceNumber: setInsuranceNumber,
			}}
			onSave={handleSave}
			onSignOut={handleSignOut}
		/>
	);
}

const FormRow = React.memo(function FormRow({
	label,
	children,
	last = false,
}: {
	label: string;
	children: React.ReactNode;
	last?: boolean;
}): React.JSX.Element {
	return (
		<View style={[styles.formRow, !last && styles.formRowBorder]}>
			<Text style={styles.formLabel}>{label}</Text>
			{children}
		</View>
	);
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	content: { padding: 20 },
	center: { flex: 1, justifyContent: "center", alignItems: "center" },
	emailCard: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	emailLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 3 },
	emailValue: { fontSize: 15, fontWeight: "600", color: "#1A2238" },
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	formRow: { paddingVertical: 12 },
	formRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
	formLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 5 },
	input: {
		fontSize: 15,
		color: "#111827",
		paddingVertical: 0,
	},
	success: { color: "#16A34A", fontSize: 14, marginBottom: 12, textAlign: "center" },
	error: { color: "#EF4444", fontSize: 14, marginBottom: 12, textAlign: "center" },
	saveBtn: {
		backgroundColor: "#E85A28",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
	},
	saveBtnDisabled: { opacity: 0.6 },
	saveBtnText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
	signOutBtn: {
		borderWidth: 1,
		borderColor: "#EF4444",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center" as const,
		marginTop: 12,
	},
	signOutBtnText: { color: "#EF4444", fontWeight: "600" as const, fontSize: 16 },
});
