import React from "react";

import ceriosLogo from "./assets/cerios-logo.svg";

export interface PortalFooterProps {
	/** Display name of the portal, e.g. "Patient Portal". */
	portalName: string;
	/** When true, renders the Cerios logo to the left of the text. Defaults to false. */
	showLogo?: boolean;
}

/**
 * Shared footer rendered at the bottom of every Cerios clinic portal.
 * Background uses each portal's `brand-navy` Tailwind token so the footer
 * blends with the portal's theme.
 */
export function PortalFooter({ portalName, showLogo = false }: PortalFooterProps): React.ReactElement {
	const year = new Date().getFullYear();
	return (
		<footer className="w-full bg-brand-navy text-white text-sm py-4 px-4 flex items-center justify-center gap-3">
			{showLogo && <img src={ceriosLogo} alt="Cerios logo" className="h-5 w-auto" />}
			<span>
				{portalName} &copy; {year}
			</span>
		</footer>
	);
}
