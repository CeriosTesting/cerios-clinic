import React from "react";

import keycloak from "../keycloak";

export default function LoginPage(): React.ReactElement | null {
	if (keycloak.authenticated) {
		window.location.replace("/");
		return null;
	}

	const handleLogin = (): void => {
		void keycloak.login({ redirectUri: window.location.origin + "/" });
	};

	return (
		<div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
			<div className="w-full max-w-md">
				<div className="text-center mb-10">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange rounded-2xl mb-4">
						<span className="text-white text-2xl font-bold">A</span>
					</div>
					<h1 className="text-3xl font-bold text-white">Admin Portal</h1>
					<p className="text-slate-400 mt-2 text-sm">Powered by Cerios Clinic</p>
				</div>

				<div className="bg-white rounded-2xl shadow-2xl p-8">
					<h2 className="text-xl font-semibold text-slate-800 mb-2">Welcome back</h2>
					<p className="text-gray-500 text-sm mb-8">Admin access only. Sign in with your clinic credentials.</p>

					<button
						onClick={handleLogin}
						className="w-full bg-brand-orange hover:bg-brand-orange-hover focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
					>
						Sign in
					</button>
				</div>

				<p className="text-center text-slate-500 text-xs mt-6">
					Contact your administrator if you need help accessing your account.
				</p>
			</div>
		</div>
	);
}
