import type { FeatureToggle } from "@clinic/shared-types";
import React, { useCallback, useEffect, useState } from "react";

import api from "../api";

interface ConfigField {
	key: string;
	label: string;
	type: "number";
	min?: number;
	max?: number;
	description?: string;
}

const CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
	"bug:api-slowdown": [
		{
			key: "minDelayMs",
			label: "Min Delay",
			type: "number",
			min: 0,
			max: 30000,
			description: "Minimum delay in milliseconds",
		},
		{
			key: "maxDelayMs",
			label: "Max Delay",
			type: "number",
			min: 1,
			max: 30000,
			description: "Maximum delay in milliseconds",
		},
	],
};

export default function FeatureTogglesPage(): React.ReactElement {
	const [toggles, setToggles] = useState<FeatureToggle[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [editToggle, setEditToggle] = useState<FeatureToggle | null>(null);
	const [configValues, setConfigValues] = useState<Record<string, number>>({});
	const [configErrors, setConfigErrors] = useState<Record<string, string>>({});

	const load = useCallback(() => {
		setLoading(true);
		void api
			.get<{ data: FeatureToggle[] }>("/feature-toggles")
			.then(r => setToggles(r.data.data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleToggle = async (toggle: FeatureToggle): Promise<void> => {
		setSaving(toggle.key);
		try {
			await api.put(`/feature-toggles/${encodeURIComponent(toggle.key)}`, {
				enabled: !toggle.enabled,
			});
			load();
		} catch {
			/* silent */
		} finally {
			setSaving(null);
		}
	};

	const openConfig = (toggle: FeatureToggle): void => {
		const schema = CONFIG_SCHEMAS[toggle.key];
		if (!schema) return;
		const current = (toggle.config ?? {}) as Record<string, number>;
		const initial: Record<string, number> = {};
		for (const field of schema) {
			initial[field.key] = typeof current[field.key] === "number" ? current[field.key] : (field.min ?? 0);
		}
		setConfigValues(initial);
		setConfigErrors({});
		setEditToggle(toggle);
	};

	const validateField = (field: ConfigField, value: number): string => {
		if (!Number.isFinite(value)) return "Must be a valid number";
		if (field.min !== undefined && value < field.min) return `Minimum is ${field.min}`;
		if (field.max !== undefined && value > field.max) return `Maximum is ${field.max}`;
		if (field.key === "maxDelayMs" && configValues["minDelayMs"] !== undefined && value < configValues["minDelayMs"]) {
			return "Must be greater than or equal to Min Delay";
		}
		return "";
	};

	const handleFieldChange = (field: ConfigField, raw: string): void => {
		const value = Number(raw);
		setConfigValues(prev => ({ ...prev, [field.key]: value }));
		setConfigErrors(prev => ({ ...prev, [field.key]: validateField(field, value) }));
	};

	const saveConfig = async (): Promise<void> => {
		if (!editToggle) return;
		const schema = CONFIG_SCHEMAS[editToggle.key] ?? [];
		const errors: Record<string, string> = {};
		for (const field of schema) {
			const err = validateField(field, configValues[field.key] ?? NaN);
			if (err) errors[field.key] = err;
		}
		if (Object.keys(errors).length > 0) {
			setConfigErrors(errors);
			return;
		}
		setSaving(editToggle.key);
		try {
			await api.put(`/feature-toggles/${encodeURIComponent(editToggle.key)}`, {
				config: configValues,
			});
			setEditToggle(null);
			load();
		} catch {
			/* silent */
		} finally {
			setSaving(null);
		}
	};

	const seedToggles = async (): Promise<void> => {
		setSaving("seed");
		try {
			await api.post("/feature-toggles/seed");
			load();
		} catch {
			/* silent */
		} finally {
			setSaving(null);
		}
	};

	const getToggleLabel = (key: string): string => {
		const labels: Record<string, string> = {
			"bug:api-slowdown": "API Slowdown",
		};
		return labels[key] ?? key;
	};

	const getToggleIcon = (key: string): string => {
		if (key.startsWith("bug:")) return "🐛";
		return "🔧";
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-brand-navy">Feature Toggles</h1>
					<p className="text-sm text-gray-500 mt-1">Toggle test bugs and features on or off</p>
				</div>
				<button className="btn-outline" onClick={() => void seedToggles()} disabled={saving === "seed"}>
					{saving === "seed" ? "Seeding..." : "Seed defaults"}
				</button>
			</div>

			{loading && <p className="text-gray-400">Loading...</p>}

			{!loading && toggles.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-gray-400 mb-4">No feature toggles found.</p>
					<button className="btn-primary" onClick={() => void seedToggles()}>
						Seed default toggles
					</button>
				</div>
			)}

			{!loading && toggles.length > 0 && (
				<div className="space-y-3">
					{toggles.map(toggle => (
						<div key={toggle.id} className="card flex items-center justify-between">
							<div className="flex items-center gap-4">
								<span className="text-2xl">{getToggleIcon(toggle.key)}</span>
								<div>
									<p className="font-semibold text-brand-navy">{getToggleLabel(toggle.key)}</p>
									<p className="text-xs text-gray-400 font-mono">{toggle.key}</p>
									{toggle.description && <p className="text-sm text-gray-500 mt-0.5">{toggle.description}</p>}
								</div>
							</div>
							<div className="flex items-center gap-3">
								{CONFIG_SCHEMAS[toggle.key] && (
									<button
										onClick={() => openConfig(toggle)}
										className="text-xs text-gray-400 hover:text-brand-navy transition-colors"
									>
										Config
									</button>
								)}
								<button
									onClick={() => void handleToggle(toggle)}
									disabled={saving === toggle.key}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 ${
										toggle.enabled ? "bg-brand-orange" : "bg-gray-300"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
											toggle.enabled ? "translate-x-6" : "translate-x-1"
										}`}
									/>
								</button>
								<span
									className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
										toggle.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
									}`}
								>
									{toggle.enabled ? "ON" : "OFF"}
								</span>
							</div>
						</div>
					))}
				</div>
			)}

			{editToggle && CONFIG_SCHEMAS[editToggle.key] && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
						<div className="flex items-center justify-between mb-5">
							<h2 className="text-lg font-bold text-brand-navy">Configure: {getToggleLabel(editToggle.key)}</h2>
							<button
								onClick={() => setEditToggle(null)}
								className="text-gray-400 hover:text-gray-600 text-xl leading-none"
							>
								&times;
							</button>
						</div>
						<div className="space-y-4">
							{CONFIG_SCHEMAS[editToggle.key].map(field => (
								<div key={field.key}>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										{field.label}
										{field.min !== undefined && field.max !== undefined && (
											<span className="text-gray-400 font-normal ml-1">
												({field.min}–{field.max} ms)
											</span>
										)}
									</label>
									{field.description && <p className="text-xs text-gray-400 mb-1">{field.description}</p>}
									<input
										type="number"
										min={field.min}
										max={field.max}
										value={configValues[field.key] ?? ""}
										onChange={e => handleFieldChange(field, e.target.value)}
										className={`form-input ${configErrors[field.key] ? "border-red-400 focus:ring-red-400" : ""}`}
									/>
									{configErrors[field.key] && <p className="text-red-500 text-xs mt-1">{configErrors[field.key]}</p>}
								</div>
							))}
						</div>
						<div className="flex gap-3 justify-end pt-5">
							<button onClick={() => setEditToggle(null)} className="btn-ghost">
								Cancel
							</button>
							<button onClick={() => void saveConfig()} className="btn-primary" disabled={saving === editToggle.key}>
								{saving === editToggle.key ? "Saving..." : "Save config"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
