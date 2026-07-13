import type { SecurityEnv } from "../../lib/security";

export type AppEnv = SecurityEnv & {
  MAX_REQUESTS_PER_HOUR?: string;
  REMOVE_BG_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export type FunctionContext = {
  env: AppEnv;
  request: Request;
};
