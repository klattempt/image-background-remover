import { describe, expect, it, vi } from "vitest";
import { createBatchToken, verifyBatchToken } from "./security";

describe("batch tokens", () => {
  it("round-trips signed claims", async () => {
    const { token, claims } = await createBatchToken(12, "test-secret");
    const verified = await verifyBatchToken(token, "test-secret");

    expect(verified).toMatchObject({ batchId: claims.batchId, count: 12 });
    expect(verified?.expiresAt).toBeGreaterThan(verified?.issuedAt ?? 0);
  });

  it("rejects tampering and the wrong secret", async () => {
    const { token } = await createBatchToken(3, "test-secret");
    const [payload, signature] = token.split(".");
    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;

    await expect(verifyBatchToken(`${tamperedPayload}.${signature}`, "test-secret")).resolves.toBeNull();
    await expect(verifyBatchToken(token, "different-secret")).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T00:00:00Z"));
    const { token } = await createBatchToken(1, "test-secret");
    vi.setSystemTime(new Date("2026-07-12T00:11:00Z"));

    await expect(verifyBatchToken(token, "test-secret")).resolves.toBeNull();
    vi.useRealTimers();
  });
});
