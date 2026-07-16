import { apiError } from "../../lib/api-errors";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
  clientIp,
  getBatchSecret,
  isAllowedOrigin,
  verifyBatchToken,
} from "../../lib/security";
import type { FunctionContext } from "../_shared/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

async function readLimitedText(response: Response, maximum = 16 * 1024) {
  const text = await response.text();
  return text.slice(0, maximum);
}

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return apiError("INVALID_REQUEST", 403);

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const secret = getBatchSecret(env);
  const claims = secret && token ? await verifyBatchToken(token, secret) : null;
  if (!secret || !token || !claims) {
    return apiError("BATCH_AUTH_REQUIRED", 401);
  }

  if (env.DB) {
    if (!claims.userId) return apiError("AUTH_REQUIRED", 401);
    const balance = await env.DB.prepare(
      `SELECT credits_remaining AS creditsRemaining, valid_until AS validUntil
       FROM user_credits WHERE user_id = ?`,
    ).bind(claims.userId).first<{ creditsRemaining: number; validUntil: string | null }>();
    const expired = balance?.validUntil ? new Date(balance.validUntil).getTime() <= Date.now() : false;
    if (!balance || expired || balance.creditsRemaining < 1) return apiError("INSUFFICIENT_CREDITS", 402);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) return apiError("INVALID_FILE_TYPE", 415);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return apiError("INVALID_REQUEST", 400);
  if (bytes.byteLength > MAX_BYTES) return apiError("FILE_TOO_LARGE", 413);

  const ip = clientIp(request);
  const rateLimit = consumeRateLimit(
    `remove:${ip}`,
    Number(env.MAX_REQUESTS_PER_HOUR ?? 60),
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", 429, rateLimit.retryAfter);
  if (!env.REMOVE_BG_API_KEY) return apiError("CONFIGURATION_ERROR", 503);

  const form = new FormData();
  form.set("size", "auto");
  form.set("format", "png");
  form.set("type", "product");
  form.set("image_file", new Blob([bytes], { type: contentType }), "upload.bin");

  let upstream: Response;
  try {
    upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": env.REMOVE_BG_API_KEY },
      body: form,
    });
  } catch {
    return apiError("UPSTREAM_UNAVAILABLE", 503);
  }

  if (!upstream.ok) {
    const detail = await readLimitedText(upstream);
    if (upstream.status === 429) {
      const retryAfter = Number(upstream.headers.get("retry-after") ?? 5);
      return apiError("RATE_LIMITED", 429, Number.isFinite(retryAfter) ? retryAfter : 5);
    }
    if (upstream.status === 400 && /foreground|image/i.test(detail)) {
      return apiError("NO_FOREGROUND", 422);
    }
    if (upstream.status >= 500) return apiError("UPSTREAM_UNAVAILABLE", 503);
    return apiError("INTERNAL_ERROR", 500);
  }

  if (env.DB && claims.userId) {
    const result = await env.DB.prepare(
      `UPDATE user_credits SET credits_remaining = credits_remaining - 1, updated_at = ?
       WHERE user_id = ? AND credits_remaining > 0
       AND (valid_until IS NULL OR valid_until > ?)`,
    ).bind(new Date().toISOString(), claims.userId, new Date().toISOString()).run();
    if (result.meta?.changes !== 1) return apiError("INSUFFICIENT_CREDITS", 402);
  }

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
