import "./index.css";

import { AuthServiceUnavailableScreen, RoleMismatchScreen } from "@clinic/portal-common";
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import keycloak from "./keycloak";

void keycloak
	.init({
		onLoad: "check-sso",
		pkceMethod: "S256",
		checkLoginIframe: false,
	})
	.then(authenticated => {
		const root = createRoot(document.getElementById("root")!);
		if (authenticated && !keycloak.hasRealmRole("patient")) {
			root.render(
				<StrictMode>
					<RoleMismatchScreen audienceLabel="patients" onSignOut={() => void keycloak.logout()} />
				</StrictMode>
			);
			return;
		}
		root.render(
			<StrictMode>
				<App />
			</StrictMode>
		);
	})
	.catch(() => {
		createRoot(document.getElementById("root")!).render(
			<StrictMode>
				<AuthServiceUnavailableScreen />
			</StrictMode>
		);
	});
