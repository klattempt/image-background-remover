import { afterEach, describe, expect, it, vi } from "vitest";
import { createBatchToken } from "../../lib/security";
import { onRequestPost as createBatchSession } from "./batch-session";
import { onRequestPost as removeBackground } from "./remove-background";

afterEach(() => vi.restoreAllMocks());

describe("Pages Functions", () => {
  it("creates a local batch session without Turnstile", async () => {
    const request = new Request("http://localhost/api/batch-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ count: 2, turnstileToken: "dev-bypass" }),
    });

    const response = await createBatchSession({
      request,
      env: { BATCH_SIGNING_SECRET: "test-secret" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ batchId: expect.any(String) });
  });

  it("forwards an image to remove.bg entirely in memory", async () => {
    const { token } = await createBatchToken(1, "test-secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const request = new Request("https://example.pages.dev/api/remove-background", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/png",
        Origin: "https://example.pages.dev",
      },
      body: new Uint8Array([1, 2, 3]),
    });

    const response = await removeBackground({
      request,
      env: {
        APP_ORIGIN: "https://example.pages.dev",
        BATCH_SIGNING_SECRET: "test-secret",
        REMOVE_BG_API_KEY: "test-api-key",
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([4, 5, 6]).buffer);
  });
});
