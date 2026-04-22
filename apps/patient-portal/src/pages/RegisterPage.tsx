import axios from "axios";
import React, { useState } from "react";
import { Link } from "react-router-dom";

import { appConfig } from "../config";
import keycloak from "../keycloak";

interface FormState {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	confirmPassword: string;
	dateOfBirth: string;
	phone: string;
}

const INITIAL: FormState = {
	firstName: "",
	lastName: "",
	email: "",
	password: "",
	confirmPassword: "",
	dateOfBirth: "",
	phone: "",
};

export default function RegisterPage(): React.ReactElement {
	const [form, setForm] = useState<FormState>(INITIAL);
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [registeredEmail, setRegisteredEmail] = useState<string>("");
	const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
		setError(null);
	};

	const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		setError(null);

		if (form.password !== form.confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setSubmitting(true);
		try {
			const body: Record<string, string> = {
				firstName: form.firstName.trim(),
				lastName: form.lastName.trim(),
				email: form.email.trim(),
				password: form.password,
				confirmPassword: form.confirmPassword,
			};
			if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth;
			if (form.phone.trim()) body.phone = form.phone.trim();

			await axios.post(`${appConfig.apiBaseUrl}/auth/register`, body);
			setRegisteredEmail(body.email);
			setSuccess(true);
		} catch (err: unknown) {
			if (axios.isAxiosError(err)) {
				const status = err.response?.status;
				const msg: string = err.response?.data?.message ?? "Registration failed. Please try again.";
				if (status === 409) {
					setError(typeof msg === "string" ? msg : "Email already registered.");
				} else if (status === 400) {
					const detail = Array.isArray(msg) ? (msg as string[]).join(", ") : msg;
					setError(detail);
				} else {
					setError("Something went wrong. Please try again.");
				}
			} else {
				setError("Unable to reach the server. Please try again later.");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handleSignIn = (): void => {
		void keycloak.login({ loginHint: form.email, redirectUri: window.location.origin + "/" });
	};

	const handleResendVerification = async (): Promise<void> => {
		if (!registeredEmail || resendState === "sending") return;
		setResendState("sending");
		try {
			await axios.post(`${appConfig.apiBaseUrl}/auth/resend-verification`, { email: registeredEmail });
		} catch {
			// endpoint is intentionally opaque — treat any response as "sent" to avoid leaking state
		}
		setResendState("sent");
	};

	return (
		<div className="min-h-screen bg-brand-navy flex flex-col items-center justify-center px-4 py-10">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange rounded-2xl mb-4">
						<span className="text-white text-2xl font-bold">C</span>
					</div>
					<h1 className="text-3xl font-bold text-white">Patient Portal</h1>
					<p className="text-blue-200 mt-2 text-sm">Powered by Clinic</p>
				</div>

				<div className="bg-white rounded-2xl shadow-2xl p-8">
					{success ? (
						/* ── Success state ── */
						<div className="text-center py-4">
							<div className="flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mx-auto mb-4">
								<svg
									className="w-7 h-7 text-green-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<h2 className="text-xl font-semibold text-brand-navy mb-2">Check your email</h2>
							<p className="text-gray-500 text-sm mb-2">
								We sent a verification link to <span className="font-medium text-brand-navy">{registeredEmail}</span>.
							</p>
							<p className="text-gray-500 text-sm mb-6">Click the link in the email before signing in.</p>
							<button
								onClick={() => {
									void handleResendVerification();
								}}
								disabled={resendState !== "idle"}
								className="btn-outline w-full mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
							>
								{resendState === "sending"
									? "Sending…"
									: resendState === "sent"
										? "Verification email re-sent"
										: "Resend verification email"}
							</button>
							<button onClick={handleSignIn} className="btn-primary w-full">
								Sign in
							</button>
						</div>
					) : (
						/* ── Registration form ── */
						<>
							<h2 className="text-xl font-semibold text-brand-navy mb-1">Create your account</h2>
							<p className="text-gray-500 text-sm mb-6">Register as a new patient to book and track appointments.</p>

							<form
								onSubmit={e => {
									void handleSubmit(e);
								}}
								noValidate
							>
								{/* Row: first + last name */}
								<div className="flex gap-3 mb-4">
									<div className="flex-1">
										<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">
											First name
										</label>
										<input
											id="firstName"
											name="firstName"
											type="text"
											required
											autoComplete="given-name"
											value={form.firstName}
											onChange={handleChange}
											className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
										/>
									</div>
									<div className="flex-1">
										<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">
											Last name
										</label>
										<input
											id="lastName"
											name="lastName"
											type="text"
											required
											autoComplete="family-name"
											value={form.lastName}
											onChange={handleChange}
											className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
										/>
									</div>
								</div>

								{/* Email */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
										Email address
									</label>
									<input
										id="email"
										name="email"
										type="email"
										required
										autoComplete="email"
										value={form.email}
										onChange={handleChange}
										className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
									/>
								</div>

								{/* Password */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
										Password
									</label>
									<input
										id="password"
										name="password"
										type="password"
										required
										minLength={8}
										autoComplete="new-password"
										value={form.password}
										onChange={handleChange}
										className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
									/>
									<p className="text-xs text-gray-400 mt-1">Minimum 8 characters.</p>
								</div>

								{/* Confirm password */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
										Confirm password
									</label>
									<input
										id="confirmPassword"
										name="confirmPassword"
										type="password"
										required
										autoComplete="new-password"
										value={form.confirmPassword}
										onChange={handleChange}
										className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
									/>
								</div>

								{/* Date of birth */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dateOfBirth">
										Date of birth <span className="text-gray-400 font-normal">(optional)</span>
									</label>
									<input
										id="dateOfBirth"
										name="dateOfBirth"
										type="date"
										autoComplete="bday"
										value={form.dateOfBirth}
										onChange={handleChange}
										className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
									/>
								</div>

								{/* Phone */}
								<div className="mb-6">
									<label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">
										Phone number <span className="text-gray-400 font-normal">(optional)</span>
									</label>
									<input
										id="phone"
										name="phone"
										type="tel"
										autoComplete="tel"
										value={form.phone}
										onChange={handleChange}
										className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
									/>
								</div>

								{/* Inline error */}
								{error && (
									<div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
										{error}
									</div>
								)}

								<button
									type="submit"
									disabled={submitting}
									className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
								>
									{submitting ? "Creating account…" : "Create account"}
								</button>
							</form>

							<div className="relative my-5">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-gray-200" />
								</div>
								<div className="relative flex justify-center text-sm">
									<span className="bg-white px-3 text-gray-400">Already have an account?</span>
								</div>
							</div>

							<Link to="/login" className="btn-outline w-full text-center block">
								Sign in
							</Link>

							<p className="text-xs text-gray-400 text-center mt-6">
								By registering you agree to our terms of service.
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
