import type { AppEnv } from "./types";

export const PAYPAL_PLANS = {
  plus: { name: "Plus", amount: "19.00", credits: 40 },
  pro: { name: "Pro", amount: "69.00", credits: 200 },
} as const;

export type PayPalPlanId = keyof typeof PAYPAL_PLANS;

export function paypalPlan(value: unknown) {
  return typeof value === "string" && value in PAYPAL_PLANS
    ? PAYPAL_PLANS[value as PayPalPlanId]
    : null;
}

export function paypalBaseUrl(env: AppEnv) {
  return env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function paypalAccessToken(env: AppEnv) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${paypalBaseUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export async function paypalApi(
  env: AppEnv,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = await paypalAccessToken(env);
  if (!accessToken) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${paypalBaseUrl(env)}${path}`, { ...init, headers });
}

export async function verifyPayPalWebhook(env: AppEnv, request: Request, event: unknown) {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const response = await paypalApi(env, "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: request.headers.get("paypal-auth-algo"),
      cert_url: request.headers.get("paypal-cert-url"),
      transmission_id: request.headers.get("paypal-transmission-id"),
      transmission_sig: request.headers.get("paypal-transmission-sig"),
      transmission_time: request.headers.get("paypal-transmission-time"),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  if (!response?.ok) return false;
  const body = (await response.json()) as { verification_status?: string };
  return body.verification_status === "SUCCESS";
}
