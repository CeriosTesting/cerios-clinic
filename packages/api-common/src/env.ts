export function readEnv(name: string): string | undefined {
	const value = process.env[name];
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function readEnvOrDefault(name: string, fallback: string): string {
	return readEnv(name) ?? fallback;
}

export function requireEnv(name: string): string {
	const value = readEnv(name);
	if (!value) {
		throw new Error(`${name} environment variable is required`);
	}
	return value;
}

export function parsePortEnv(name: string, fallback: number): number {
	const value = readEnv(name);
	if (!value) {
		return fallback;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
		throw new Error(`${name} must be an integer between 1 and 65535`);
	}

	return parsed;
}

export function parseOriginsEnv(name: string, fallback: string): string[] {
	const value = readEnv(name) ?? fallback;
	const origins = value
		.split(",")
		.map(origin => origin.trim())
		.filter(origin => origin.length > 0);

	if (origins.length === 0) {
		throw new Error(`${name} must include at least one origin`);
	}

	return origins;
}

export function parseHttpUrlEnv(name: string, fallback: string): string {
	const value = readEnv(name) ?? fallback;

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid URL`);
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`${name} must start with http:// or https://`);
	}

	return parsed.origin;
}
