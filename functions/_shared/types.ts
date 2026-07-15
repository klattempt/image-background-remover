import type { SecurityEnv } from "../../lib/security";

export type AppEnv = SecurityEnv & {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  MAX_REQUESTS_PER_HOUR?: string;
  REMOVE_BG_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1Database = {
  prepare: (query: string) => D1Statement;
};

export type FunctionContext = {
  env: AppEnv;
  request: Request;
};
