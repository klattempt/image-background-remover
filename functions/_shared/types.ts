import type { SecurityEnv } from "../../lib/security";

export type AppEnv = SecurityEnv & {
  CREEM_API_KEY?: string;
  CREEM_ENVIRONMENT?: string;
  CREEM_PLUS_PRODUCT_ID?: string;
  CREEM_PRO_PRODUCT_ID?: string;
  CREEM_WEBHOOK_SECRET?: string;
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  MAX_REQUESTS_PER_HOUR?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  PAYPAL_WEBHOOK_ID?: string;
  REMOVE_BG_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

export type D1Database = {
  prepare: (query: string) => D1Statement;
};

export type FunctionContext = {
  env: AppEnv;
  request: Request;
};
