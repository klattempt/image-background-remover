import { afterEach, describe, expect, it, vi } from "vitest";
import type { D1Database, D1Statement } from "../../_shared/types";
import { onRequestPost as createCheckout } from "./checkout";
import { onRequestPost as receiveWebhook } from "./webhook";

afterEach(() => vi.restoreAllMocks());

function creemDb() {
  const executed: Array<{ query: string; values: unknown[] }> = [];
  const db: D1Database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement: D1Statement = {
        bind(...nextValues: unknown[]) { values = nextValues; return statement; },
        async first<T>() {
          if (query.includes("FROM sessions")) return { userId: "user-1" } as T;
          if (query.includes("FROM creem_webhook_events")) return null;
          if (query.includes("FROM creem_orders")) {
            return {
              checkoutId: "ch_test_1",
              productId: "prod_plus",
              amountCents: 1900,
              currency: "USD",
            } as T;
          }
          return null;
        },
        async run() { executed.push({ query, values }); return { meta: { changes: 1 } }; },
      };
      return statement;
    },
  };
  return { db, executed };
}

function testEnv(db: D1Database) {
  return {
    APP_ORIGIN: "https://example.com",
    CREEM_API_KEY: "creem_test_key",
    CREEM_ENVIRONMENT: "test",
    CREEM_PLUS_PRODUCT_ID: "prod_plus",
    CREEM_PRO_PRODUCT_ID: "prod_pro",
    CREEM_WEBHOOK_SECRET: "webhook-secret",
    DB: db,
  };
}

async function webhookSignature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("Creem one-time checkout", () => {
  it("creates a test checkout for the authenticated Plus user", async () => {
    const { db, executed } = creemDb();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      id: "ch_test_1",
      checkout_url: "https://checkout.creem.io/ch_test_1",
      status: "pending",
    }));
    const response = await createCheckout({
      request: new Request("https://example.com/api/creem/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
          Cookie: "__Host-cutline_session=session-token",
        },
        body: JSON.stringify({ plan: "plus" }),
      }),
      env: testEnv(db),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ checkoutUrl: "https://checkout.creem.io/ch_test_1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://test-api.creem.io/v1/checkouts");
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { product_id: string; metadata: { userId: string } };
    expect(payload).toMatchObject({ product_id: "prod_plus", metadata: { userId: "user-1" } });
    expect(executed.some(({ query }) => query.includes("INSERT INTO creem_orders"))).toBe(true);
  });

  it("accepts a signed test webhook without issuing production credits", async () => {
    const { db, executed } = creemDb();
    const payload = JSON.stringify({
      id: "evt_test_1",
      eventType: "checkout.completed",
      object: {
        id: "ch_test_1",
        request_id: "internal-1",
        customer: { email: "buyer@example.com" },
        order: {
          id: "ord_test_1",
          product: "prod_plus",
          amount: 1900,
          currency: "USD",
          status: "paid",
          mode: "test",
        },
      },
    });
    const signature = await webhookSignature(payload, "webhook-secret");
    const response = await receiveWebhook({
      request: new Request("https://example.com/api/creem/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "creem-signature": signature },
        body: payload,
      }),
      env: testEnv(db),
    });

    expect(response.status).toBe(200);
    const orderUpdate = executed.find(({ query }) => query.includes("UPDATE creem_orders"));
    expect(orderUpdate?.values[0]).toBe("TEST_COMPLETED");
    expect(orderUpdate?.values).not.toContain("COMPLETED");
  });

  it("rejects an invalid webhook signature", async () => {
    const { db } = creemDb();
    const response = await receiveWebhook({
      request: new Request("https://example.com/api/creem/webhook", {
        method: "POST",
        headers: { "creem-signature": "0".repeat(64) },
        body: JSON.stringify({ id: "evt_fake", eventType: "checkout.completed" }),
      }),
      env: testEnv(db),
    });
    expect(response.status).toBe(401);
  });
});
