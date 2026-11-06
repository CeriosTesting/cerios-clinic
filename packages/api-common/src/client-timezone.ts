import { CLIENT_TIMEZONE_HEADER } from "@clinic/shared-types";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Used when a request has no (valid) client timezone, e.g. calls from Swagger or Postman. */
export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

/** Returns `value` if it is a valid IANA timezone, otherwise {@link DEFAULT_TIMEZONE}. */
export function resolveTimeZone(value?: string | null): string {
	if (!value) return DEFAULT_TIMEZONE;
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return value;
	} catch {
		return DEFAULT_TIMEZONE;
	}
}

/** Injects the caller's timezone from the `X-Client-Timezone` header, validated, with a fallback. */
export const ClientTimeZone = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
	const header = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>().headers[
		CLIENT_TIMEZONE_HEADER.toLowerCase()
	];
	return resolveTimeZone(Array.isArray(header) ? header[0] : header);
});
