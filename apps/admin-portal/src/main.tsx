import "./index.css";

import { RoleMismatchScreen } from "@clinic/portal-common";
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
		if (authenticated && !keycloak.hasRealmRole("admin")) {
			root.render(<RoleMismatchScreen audienceLabel="administrators" onSignOut={() => void keycloak.logout()} />);
			return;
		}
		root.render(
			<React.StrictMode>
				<App />
			</React.StrictMode>
		);
	});
