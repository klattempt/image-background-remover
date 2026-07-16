import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256 } from "../../_shared/auth";
import type { D1Database, D1Statement } from "../../_shared/types";
import { onRequestPost as captureOrder } from "./capture-order";
import { onRequestPost as createOrder } from "./orders";

afterEach(() => vi.restoreAllMocks());

function paymentDb() {
  const executed: Array<{ query: string; values: unknown[] }> = [];
  const db: D1Database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement: D1Statement = {
        bind(...nextValues: unknown[]) { values = nextValues; return statement; },
        async first<T>() {
          if (query.includes("FROM sessions")) return { userId: "user-1" } as T;
          if (query.includes("FROM paypal_orders")) {
            return { amount: "19.00", currency: "USD", status: "CREATED" } as T;
          }
          if (query.includes("FROM user_credits")) {
            return { plan: "plus", creditsRemaining: 40, creditsTotal: 40, validUntil: "2099-01-01T00:00:00.000Z" } as T;
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

function paymentRequest(path: string, body: unknown) {
  return new Request(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.com",
      Cookie: "__Host-cutline_session=session-token",
    },
    body: JSON.stringify(body),
  });
}

describe("PayPal one-time checkout", () => {
  it("creates a USD Plus order for the authenticated user", async () => {
    const { db, executed } = paymentDb();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ access_token: "sandbox-access" }))
      .mockResolvedValueOnce(Response.json({ id: "5O190127TN364715T", status: "CREATED" }));

    const response = await createOrder({
      request: paymentRequest("/api/paypal/orders", { plan: "plus" }),
      env: {
        APP_ORIGIN: "https://example.com",
        DB: db,
        PAYPAL_CLIENT_ID: "client",
        PAYPAL_CLIENT_SECRET: "secret",
        PAYPAL_ENVIRONMENT: "sandbox",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ orderId: "5O190127TN364715T" });
    expect(await sha256("session-token")).toHaveLength(64);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    const orderPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      purchase_units: Array<{ amount: { currency_code: string; value: string }; custom_id: string }>;
    };
    expect(orderPayload.purchase_units[0]).toMatchObject({
      amount: { currency_code: "USD", value: "19.00" },
      custom_id: "user-1",
    });
    expect(executed.some(({ query }) => query.includes("INSERT INTO paypal_orders"))).toBe(true);
  });

  it("captures an approved order and activates its 30-day credits", async () => {
    const { db, executed } = paymentDb();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ access_token: "sandbox-access" }))
      .mockResolvedValueOnce(Response.json({
        status: "COMPLETED",
        payer: { email_address: "buyer@example.com" },
        purchase_units: [{ payments: { captures: [{ amount: { currency_code: "USD", value: "19.00" } }] } }],
      }));

    const response = await captureOrder({
      request: paymentRequest("/api/paypal/capture-order", { orderId: "5O190127TN364715T" }),
      env: {
        APP_ORIGIN: "https://example.com",
        DB: db,
        PAYPAL_CLIENT_ID: "client",
        PAYPAL_CLIENT_SECRET: "secret",
        PAYPAL_ENVIRONMENT: "sandbox",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; credits: { creditsRemaining: number } };
    expect(body.ok).toBe(true);
    expect(body.credits.creditsRemaining).toBe(40);
    expect(executed.some(({ query, values }) => query.includes("UPDATE paypal_orders") && values.includes("buyer@example.com"))).toBe(true);
  });
});
