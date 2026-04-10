import { UploadOutlined } from "@ant-design/icons";
import { Button, Card, Spin, Typography, message } from "antd";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getPatient, uploadPatientPhoto } from "../api";

const { Title, Text } = Typography;

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
					// Wider than target: crop sides
					srcW = Math.round(img.height * targetRatio);
					srcX = Math.round((img.width - srcW) / 2);
				} else if (srcRatio < targetRatio) {
					// Taller than target: crop top/bottom
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
			.catch(() => message.error("Could not load patient"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 1 * 1024 * 1024) {
			message.error("File must be 1 MB or smaller");
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		try {
			const dataUrl = await resizeToPortrait(file);
			setPreview(dataUrl);
			setPendingData(dataUrl);
		} catch {
			message.error("Could not process image");
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
			message.success("Photo updated");
		} catch {
			message.error("Upload failed. Please try again.");
		} finally {
			setUploading(false);
		}
	};

	const currentPhoto = preview ?? patient?.patient?.photo ?? null;

	if (loading) {
		return (
			<div style={{ textAlign: "center", padding: 64 }}>
				<Spin size="large" />
			</div>
		);
	}

	if (!patient) return null;

	return (
		<div style={{ maxWidth: 520 }}>
			<Button
				type="link"
				style={{ paddingLeft: 0, color: "#E85A28", marginBottom: 8 }}
				onClick={() => {
					void navigate("/patients");
				}}
			>
				← Back to patients
			</Button>

			<Title level={3} style={{ color: "#1A2238", marginTop: 8, marginBottom: 16 }} data-testid="patient-name">
				{patient.firstName} {patient.lastName}
			</Title>

			<Card style={{ marginBottom: 16 }}>
				<PatientInfoCard patient={patient} currentPhoto={currentPhoto} preview={preview} />
			</Card>

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
		<div style={{ marginBottom: 12 }}>
			<Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
				{label}
			</Text>
			<Text strong style={{ color: "#1A2238" }} data-testid={testId}>
				{value}
			</Text>
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
		<div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
			<div style={{ flexShrink: 0 }}>
				<img
					src={currentPhoto ?? "/placeholder-avatar.svg"}
					alt="Patient photo"
					data-testid="patient-photo"
					style={{
						width: PORTRAIT_W / 2,
						height: PORTRAIT_H / 2,
						objectFit: "cover",
						borderRadius: 8,
						border: "1px solid #E8EDF2",
						display: "block",
					}}
				/>
				{preview && (
					<Text
						type="secondary"
						style={{ fontSize: 11, display: "block", marginTop: 4, textAlign: "center" }}
						data-testid="patient-photo-preview-label"
					>
						Preview
					</Text>
				)}
			</div>
			<div style={{ flex: 1 }}>
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
		<Card title="Update photo">
			<input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
			<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
				<Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
					Select image
				</Button>
				{pendingData && (
					<Button type="primary" loading={uploading} onClick={onUpload}>
						Save photo
					</Button>
				)}
			</div>
			<Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
				Max 1 MB · JPEG, PNG or WebP · Automatically cropped to 300×400 px portrait
			</Text>
		</Card>
	);
}
