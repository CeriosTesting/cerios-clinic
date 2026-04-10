import React from "react";
import { useNavigate } from "react-router-dom";

import keycloak from "../keycloak";

export default function LoginPage(): React.ReactElement {
	const navigate = useNavigate();
	const handleLogin = (): void => {
		void keycloak.login({ redirectUri: window.location.origin + "/" });
	};
	const handleRegister = (): void => {
		void navigate("/register");
	};

	return (
		<div className="min-h-screen bg-brand-navy flex flex-col items-center justify-center px-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-10">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange rounded-2xl mb-4">
						<span className="text-white text-2xl font-bold">C</span>
					</div>
					<h1 className="text-3xl font-bold text-white">Patient Portal</h1>
					<p className="text-blue-200 mt-2 text-sm">Powered by Clinic</p>
				</div>

				{/* Card */}
				<div className="bg-white rounded-2xl shadow-2xl p-8">
					<h2 className="text-xl font-semibold text-brand-navy mb-2">Welcome back</h2>
					<p className="text-gray-500 text-sm mb-8">
						Sign in to view your appointments and manage your health profile.
					</p>

					<button onClick={handleLogin} className="btn-primary w-full mb-4 text-center">
						Sign in
					</button>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-200" />
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="bg-white px-3 text-gray-400">New patient?</span>
						</div>
					</div>

					<button onClick={handleRegister} className="btn-outline w-full text-center">
						Create an account
					</button>

					<p className="text-xs text-gray-400 text-center mt-6">By registering you agree to our terms of service.</p>
				</div>
			</div>
		</div>
	);
}
