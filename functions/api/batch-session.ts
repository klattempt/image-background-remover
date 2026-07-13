import { apiError } from "../../lib/api-errors";
import {
  clientIp,
  createBatchToken,
  getBatchSecret,
  isAllowedOrigin,
} from "../../lib/security";
import type { FunctionContext } from "../_shared/types";

type SessionBody = { count?: unknown; turnstileToken?: unknown };

async function verifyTurnstile(request: Request, token: string, ip: string, secret?: string) {
  if (!secret) {
    const hostname = new URL(request.url).hostname;
    return (hostname === "localhost" || hostname === "127.0.0.1") && token === "dev-bypass";
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!result.ok) return false;
  const data = (await result.json()) as { success?: boolean };
  return data.success === true;
}

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return apiError("INVALID_REQUEST", 403);

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
  if (!(await verifyTurnstile(request, body.turnstileToken, ip, env.TURNSTILE_SECRET_KEY))) {
    return apiError("BATCH_AUTH_REQUIRED", 401);
  }

  const secret = getBatchSecret(env);
  if (!secret) return apiError("CONFIGURATION_ERROR", 503);
  const { token, claims } = await createBatchToken(count, secret);
  return Response.json(
    { token, batchId: claims.batchId, expiresAt: claims.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
