import { afterEach, vi } from "vitest";

// Tests that freeze the clock (see `freezeTime`) always get the real clock back.
afterEach(() => {
	vi.useRealTimers();
});
