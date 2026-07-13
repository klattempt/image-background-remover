import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import {
  clientIp,
  createBatchToken,
  getBatchSecret,
  isAllowedOrigin,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionBody = { count?: unknown; turnstileToken?: unknown };

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" && token === "dev-bypass";

  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, cache: "no-store" },
  );
  if (!result.ok) return false;
  const data = (await result.json()) as { success?: boolean };
  return data.success === true;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return apiError("INVALID_REQUEST", 403);

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return apiError("INVALID_REQUEST", 400);
  }

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return apiError("INVALID_REQUEST", 400);
  }
  if (typeof body.turnstileToken !== "string" || !body.turnstileToken) {
    return apiError("BATCH_AUTH_REQUIRED", 401);
  }

  const ip = clientIp(request);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return apiError("BATCH_AUTH_REQUIRED", 401);
  }

  const secret = getBatchSecret();
  if (!secret) return apiError("CONFIGURATION_ERROR", 503);
  const { token, claims } = await createBatchToken(count, secret);
  return NextResponse.json(
    { token, batchId: claims.batchId, expiresAt: claims.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
