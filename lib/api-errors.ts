import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "BATCH_AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "NO_FOREGROUND"
  | "UPSTREAM_UNAVAILABLE"
  | "DAILY_BUDGET_REACHED"
  | "INVALID_REQUEST"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error: { code } }, { status });
  response.headers.set("Cache-Control", "no-store");
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}
