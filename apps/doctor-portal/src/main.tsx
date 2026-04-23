import "./index.css";

import { AuthServiceUnavailableScreen, RoleMismatchScreen } from "@clinic/portal-common";
import React from "react";
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
		if (authenticated && !keycloak.hasRealmRole("doctor")) {
			root.render(<RoleMismatchScreen audienceLabel="doctors" onSignOut={() => void keycloak.logout()} />);
			return;
		}
		root.render(
			<React.StrictMode>
				<App />
			</React.StrictMode>
		);
	})
	.catch(() => {
		createRoot(document.getElementById("root")!).render(<AuthServiceUnavailableScreen />);
	});
