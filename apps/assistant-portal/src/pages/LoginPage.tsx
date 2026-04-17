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
		<div className="flex min-h-screen font-sans">
			{/* Left branding panel */}
			<div className="hidden sm:flex w-[42%] min-w-[280px] bg-brand-navy flex-col items-center justify-center px-10 py-12">
				<div className="w-[72px] h-[72px] rounded-[20px] bg-brand-primary flex items-center justify-center mb-7">
					<span className="text-white text-[28px] font-bold">A</span>
				</div>
				<div className="text-[11px] text-white/40 tracking-[3px] uppercase mb-2.5">Cerios Clinic</div>
				<h1 className="text-[26px] font-bold text-white text-center mb-3.5">Assistant Portal</h1>
				<p className="text-sm text-white/45 text-center leading-relaxed max-w-[220px]">
					Manage appointments and coordinate patient care
				</p>
			</div>

			{/* Right sign-in panel */}
			<div className="flex-1 bg-white flex flex-col items-center justify-center px-10 py-12">
				<div className="w-full max-w-[360px]">
					{/* Mobile-only branding */}
					<div className="sm:hidden text-center mb-8">
						<div className="w-16 h-16 rounded-2xl bg-brand-primary flex items-center justify-center mx-auto mb-4">
							<span className="text-white text-2xl font-bold">A</span>
						</div>
						<div className="text-[10px] text-gray-400 tracking-[2px] uppercase">Cerios Clinic</div>
						<h1 className="text-xl font-bold text-brand-navy mt-1">Assistant Portal</h1>
					</div>

					<h2 className="text-2xl font-bold text-brand-navy mb-2">Welcome back</h2>
					<p className="text-sm text-gray-500 mb-9 leading-relaxed">
						Sign in with your clinic credentials to continue. Authorized staff only.
					</p>
					<button onClick={handleLogin} className="btn-primary w-full py-3.5 text-[15px]">
						Sign in
					</button>
					<p className="text-xs text-gray-400 text-center mt-7">
						Contact your administrator if you need help accessing your account.
					</p>
				</div>
			</div>
		</div>
	);
}
