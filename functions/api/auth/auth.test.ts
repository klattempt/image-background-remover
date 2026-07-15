import { afterEach, describe, expect, it, vi } from "vitest";
import { OAUTH_STATE_COOKIE } from "../../_shared/auth";
import { onRequestGet as callback } from "./callback";
import { onRequestGet as startGoogleLogin } from "./google";
import { onRequestGet as getSession } from "./session";

afterEach(() => vi.restoreAllMocks());

describe("Google authentication", () => {
  it("starts OAuth with matching state and a secure cookie", async () => {
    const response = await startGoogleLogin({
      request: new Request("https://example.com/api/auth/google"),
      env: { GOOGLE_CLIENT_ID: "client-id" },
    });
    const location = new URL(response.headers.get("Location")!);
    const cookie = response.headers.get("Set-Cookie")!;

    expect(response.status).toBe(302);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });

  it("rejects a callback whose state does not match", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await callback({
      request: new Request("https://example.com/api/auth/callback?code=code&state=wrong", {
        headers: { Cookie: `${OAUTH_STATE_COOKIE}=expected` },
      }),
      env: {},
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("auth_error=invalid_state");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an anonymous session without a cookie", async () => {
    const response = await getSession({
      request: new Request("https://example.com/api/auth/session"),
      env: {},
    });
    await expect(response.json()).resolves.toEqual({ user: null });
  });
});
