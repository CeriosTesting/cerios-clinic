import React from "react";

import ceriosLogo from "./assets/cerios-logo.svg";

export interface PortalFooterProps {
	/** Display name of the portal, e.g. "Patient Portal". */
	portalName: string;
}

/**
 * Shared footer rendered at the bottom of every Cerios clinic portal.
 * Shows the Cerios logo followed by "{portalName} © {year}".
 */
export function PortalFooter({ portalName }: PortalFooterProps): React.ReactElement {
	const year = new Date().getFullYear();
	return (
		<footer
			style={{ backgroundColor: "#1A2233" }}
			className="w-full text-white text-sm py-4 px-4 flex items-center justify-center gap-3"
		>
			<img src={ceriosLogo} alt="Cerios logo" className="h-5 w-auto" />
			<span>
				{portalName} &copy; {year}
			</span>
		</footer>
	);
}
