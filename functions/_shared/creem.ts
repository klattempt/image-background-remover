import type { AppEnv } from "./types";

export const CREEM_PLANS = {
  plus: { name: "Plus", amountCents: 1900, credits: 40 },
  pro: { name: "Pro", amountCents: 6900, credits: 200 },
} as const;

export type CreemPlanId = keyof typeof CREEM_PLANS;

export function creemPlan(env: AppEnv, value: unknown) {
  if (value !== "plus" && value !== "pro") return null;
  const productId = value === "plus" ? env.CREEM_PLUS_PRODUCT_ID : env.CREEM_PRO_PRODUCT_ID;
  return productId ? { id: value, productId, ...CREEM_PLANS[value] } : null;
}

export function creemBaseUrl(env: AppEnv) {
  return env.CREEM_ENVIRONMENT === "live"
    ? "https://api.creem.io"
    : "https://test-api.creem.io";
}

export async function creemApi(env: AppEnv, path: string, init: RequestInit = {}) {
  if (!env.CREEM_API_KEY) return null;
  const headers = new Headers(init.headers);
  headers.set("x-api-key", env.CREEM_API_KEY);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return fetch(`${creemBaseUrl(env)}${path}`, { ...init, headers });
}

export async function verifyCreemWebhook(rawBody: string, signature: string | null, secret?: string) {
  if (!signature || !secret || !/^[a-f0-9]{64}$/iu.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let difference = expected.length ^ signature.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (signature.charCodeAt(index) || 0);
  }
  return difference === 0;
}
