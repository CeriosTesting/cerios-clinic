import type { InternalAxiosRequestConfig } from "axios";
import type Keycloak from "keycloak-js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createApi } from "./api";

interface FakeKeycloak {
	token?: string;
	isTokenExpired: Mock<(minValidity: number) => boolean>;
	updateToken: Mock<(minValidity: number) => Promise<boolean>>;
	login: Mock<() => Promise<void>>;
}

let kc: FakeKeycloak;

beforeEach(() => {
	kc = {
		token: "token-1",
		isTokenExpired: vi.fn<(minValidity: number) => boolean>(() => false),
		updateToken: vi.fn<(minValidity: number) => Promise<boolean>>(() => Promise.resolve(true)),
		login: vi.fn<() => Promise<void>>(() => Promise.resolve()),
	};
});

/** Sends a request through the real interceptors and returns the headers that would go over the wire. */
async function sentHeaders(): Promise<Record<string, unknown>> {
	let captured: InternalAxiosRequestConfig | undefined;
	const api = createApi({ baseUrl: "http://api.test", keycloak: kc as unknown as Keycloak });
	await api.get("/ping", {
		adapter: config => {
			captured = config;
			return Promise.resolve({ data: null, status: 200, statusText: "OK", headers: {}, config });
		},
	});
	return captured?.headers.toJSON() ?? {};
}

describe("createApi", () => {
	it("sends the browser timezone, which the API uses for email times", async () => {
		expect((await sentHeaders())["X-Client-Timezone"]).toBe("Europe/Amsterdam");
	});

	it("attaches the bearer token without refreshing a fresh token", async () => {
		expect((await sentHeaders()).Authorization).toBe("Bearer token-1");
		expect(kc.updateToken).not.toHaveBeenCalled();
	});

	it("refreshes an almost-expired token first and sends the new one", async () => {
		kc.isTokenExpired.mockReturnValue(true);
		kc.updateToken.mockImplementation(async () => {
			await Promise.resolve();
			kc.token = "token-2";
			return true;
		});
		expect((await sentHeaders()).Authorization).toBe("Bearer token-2");
		expect(kc.updateToken).toHaveBeenCalledWith(30);
	});

	it("sends the user to login when the refresh fails", async () => {
		kc.isTokenExpired.mockReturnValue(true);
		kc.updateToken.mockReturnValue(Promise.reject(new Error("refresh failed")));
		await sentHeaders();
		expect(kc.login).toHaveBeenCalled();
	});

	it("sends no Authorization header when not logged in", async () => {
		kc.token = undefined;
		expect(await sentHeaders()).not.toHaveProperty("Authorization");
	});
});
