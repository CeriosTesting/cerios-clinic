import { Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { getPatient, uploadPatientPhoto } from "../api";

const PORTRAIT_W = 300;
const PORTRAIT_H = 400;

interface PatientDetail {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	patient: {
		id: string;
		dateOfBirth?: string | null;
		phone?: string | null;
		insuranceNumber?: string | null;
		photo?: string | null;
	} | null;
}

function resizeToPortrait(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e): void => {
			const img = new Image();
			img.onload = (): void => {
				const targetRatio = PORTRAIT_W / PORTRAIT_H;
				const srcRatio = img.width / img.height;
				let srcX = 0;
				let srcY = 0;
				let srcW = img.width;
				let srcH = img.height;

				if (srcRatio > targetRatio) {
					srcW = Math.round(img.height * targetRatio);
					srcX = Math.round((img.width - srcW) / 2);
				} else if (srcRatio < targetRatio) {
					srcH = Math.round(img.width / targetRatio);
					srcY = Math.round((img.height - srcH) / 2);
				}

				const canvas = document.createElement("canvas");
				canvas.width = PORTRAIT_W;
				canvas.height = PORTRAIT_H;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					reject(new Error("Canvas unavailable"));
					return;
				}
				ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, PORTRAIT_W, PORTRAIT_H);
				resolve(canvas.toDataURL("image/jpeg", 0.85));
			};
			img.onerror = (): void => {
				reject(new Error("Invalid image"));
			};
			img.src = e.target!.result as string;
		};
		reader.onerror = (): void => {
			reject(new Error("File read failed"));
		};
		reader.readAsDataURL(file);
	});
}

function dataUrlToFormData(dataUrl: string): FormData {
	const [, base64] = dataUrl.split(",");
	const bytes = atob(base64);
	const buffer = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		buffer[i] = bytes.charCodeAt(i);
	}
	const blob = new Blob([buffer], { type: "image/jpeg" });
	const fd = new FormData();
	fd.append("photo", blob, "photo.jpg");
	return fd;
}

export default function PatientDetailPage(): React.ReactElement | null {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [patient, setPatient] = useState<PatientDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [preview, setPreview] = useState<string | null>(null);
	const [pendingData, setPendingData] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!id) return;
		void getPatient(id)
			.then((r: unknown) => setPatient((r as { data: { data: PatientDetail } }).data.data))
			.catch(() => toast.error("Could not load patient"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 1 * 1024 * 1024) {
			toast.error("File must be 1 MB or smaller");
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		try {
			const dataUrl = await resizeToPortrait(file);
			setPreview(dataUrl);
			setPendingData(dataUrl);
		} catch {
			toast.error("Could not process image");
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, []);

	const handleUpload = async (): Promise<void> => {
		if (!pendingData || !id) return;
		setUploading(true);
		try {
			const formData = dataUrlToFormData(pendingData);
			const r = (await uploadPatientPhoto(id, formData)) as { data: { data: { photo: string } } };
			setPatient(prev => (prev ? { ...prev, patient: { ...prev.patient!, photo: r.data.data.photo } } : prev));
			setPreview(null);
			setPendingData(null);
			toast.success("Photo updated");
		} catch {
			toast.error("Upload failed. Please try again.");
		} finally {
			setUploading(false);
		}
	};

	const currentPhoto = preview ?? patient?.patient?.photo ?? null;

	if (loading) {
		return (
			<div className="text-center py-16">
				<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-r-transparent" />
			</div>
		);
	}

	if (!patient) return null;

	return (
		<div className="max-w-lg">
			<button
				className="btn-link text-brand-accent pl-0 mb-2"
				onClick={() => {
					void navigate("/patients");
				}}
			>
				← Back to patients
			</button>

			<h1 className="text-2xl font-bold text-brand-navy mt-2 mb-4" data-testid="patient-name">
				{patient.firstName} {patient.lastName}
			</h1>

			<div className="card mb-4">
				<PatientInfoCard patient={patient} currentPhoto={currentPhoto} preview={preview} />
			</div>

			<PhotoUploadCard
				fileInputRef={fileInputRef}
				preview={preview}
				pendingData={pendingData}
				uploading={uploading}
				onFileChange={e => {
					void handleFileChange(e);
				}}
				onUpload={() => {
					void handleUpload();
				}}
			/>
		</div>
	);
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId?: string }): React.ReactElement {
	return (
		<div className="mb-3">
			<span className="text-[11px] uppercase tracking-wider text-gray-400 block">{label}</span>
			<span className="font-semibold text-brand-navy" data-testid={testId}>
				{value}
			</span>
		</div>
	);
}

function PatientInfoCard({
	patient,
	currentPhoto,
	preview,
}: {
	patient: PatientDetail;
	currentPhoto: string | null;
	preview: string | null;
}): React.ReactElement {
	return (
		<div className="flex gap-6 items-start">
			<div className="shrink-0">
				<img
					src={currentPhoto ?? "/placeholder-avatar.svg"}
					alt="Patient photo"
					data-testid="patient-photo"
					className="w-[150px] h-[200px] object-cover rounded-lg border border-gray-200 block"
				/>
				{preview && (
					<span className="text-[11px] text-gray-400 block mt-1 text-center" data-testid="patient-photo-preview-label">
						Preview
					</span>
				)}
			</div>
			<div className="flex-1 min-w-0">
				<InfoRow label="Email" value={patient.email} testId="patient-info-email" />
				<InfoRow label="Phone" value={patient.patient?.phone ?? "—"} testId="patient-info-phone" />
				<InfoRow
					label="Date of birth"
					value={patient.patient?.dateOfBirth ? new Date(patient.patient.dateOfBirth).toLocaleDateString("en-NL") : "—"}
					testId="patient-info-date-of-birth"
				/>
				<InfoRow label="Insurance #" value={patient.patient?.insuranceNumber ?? "—"} testId="patient-info-insurance" />
			</div>
		</div>
	);
}

function PhotoUploadCard({
	fileInputRef,
	pendingData,
	uploading,
	onFileChange,
	onUpload,
}: {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	preview: string | null;
	pendingData: string | null;
	uploading: boolean;
	onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onUpload: () => void;
}): React.ReactElement {
	return (
		<div className="card">
			<h2 className="text-base font-semibold text-brand-navy mb-3">Update photo</h2>
			<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
			<div className="flex gap-2 items-center">
				<button className="btn-outline inline-flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
					<Upload size={16} />
					Select image
				</button>
				{pendingData && (
					<button className="btn-primary" disabled={uploading} onClick={onUpload}>
						{uploading ? "Saving..." : "Save photo"}
					</button>
				)}
			</div>
			<p className="text-gray-400 text-xs mt-2">
				Max 1 MB · JPEG, PNG or WebP · Automatically cropped to 300×400 px portrait
			</p>
		</div>
	);
}
