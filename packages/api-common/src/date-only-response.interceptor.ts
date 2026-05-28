import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

/**
 * Normalizes any `dateOfBirth` field anywhere in a JSON response payload to a
 * `YYYY-MM-DD` string. This exists because Prisma returns `dateOfBirth` as a
 * full `Date`/ISO timestamp, but our OpenAPI contract documents it as a
 * `format: "date"` (date-only) string. Applied globally in `bootstrapApi`.
 *
 * Behaviour notes:
 * - Only fields literally named `dateOfBirth` are rewritten. Other date fields
 *   (e.g. `createdAt`, `scheduledAt`) remain `date-time`.
 * - The walker is non-mutating: it returns the original object reference when
 *   nothing changes, and a shallow-cloned copy when a field is rewritten. This
 *   keeps shared/cached upstream references safe.
 * - `Date`, `Buffer`, typed arrays, primitives, and already-visited objects
 *   are returned as-is.
 */
function toDateOnlyString(value: Date | string): string {
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	const datePrefix = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value)?.[1];
	if (datePrefix) {
		return datePrefix;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function normalizeArray(value: unknown[], visited: WeakSet<object>): unknown {
	let changed = false;
	const next: unknown[] = new Array(value.length);
	for (let i = 0; i < value.length; i += 1) {
		const item: unknown = value[i];
		const normalized = normalizeDateOnlyFields(item, visited);
		if (normalized !== item) {
			changed = true;
		}
		next[i] = normalized;
	}
	return changed ? next : value;
}

function normalizeObject(value: object, visited: WeakSet<object>): unknown {
	let changed = false;
	const next: Record<string, unknown> = {};
	for (const [key, nested] of Object.entries(value)) {
		const normalized =
			key === "dateOfBirth" && (nested instanceof Date || typeof nested === "string")
				? toDateOnlyString(nested)
				: normalizeDateOnlyFields(nested, visited);
		next[key] = normalized;
		if (normalized !== nested) {
			changed = true;
		}
	}
	if (!changed) {
		return value;
	}
	const proto = Object.getPrototypeOf(value) as object | null;
	const cloned = proto && proto !== Object.prototype ? Object.create(proto) : {};
	return Object.assign(cloned, next);
}

function normalizeDateOnlyFields(value: unknown, visited: WeakSet<object>): unknown {
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (value instanceof Date || Buffer.isBuffer(value) || ArrayBuffer.isView(value)) {
		return value;
	}
	if (visited.has(value)) {
		return value;
	}
	visited.add(value);
	return Array.isArray(value) ? normalizeArray(value, visited) : normalizeObject(value, visited);
}

@Injectable()
export class DateOnlyResponseInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(map(value => normalizeDateOnlyFields(value, new WeakSet<object>())));
	}
}
