import { consumeRateLimit } from "../../../lib/rate-limit";
import { clientIp, isAllowedOrigin } from "../../../lib/security";
import { createUserSession, hashPassword, normalizeEmail, validPassword } from "../../_shared/credentials";
import type { FunctionContext } from "../../_shared/types";

type RegisterBody = { email?: unknown; password?: unknown };

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return authError("INVALID_REQUEST", 403);
  if (!env.DB) return authError("NOT_CONFIGURED", 503);

  const rate = consumeRateLimit(`auth-register:${clientIp(request)}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) return authError("RATE_LIMITED", 429, rate.retryAfter);

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return authError("INVALID_REQUEST", 400);
  }

  const email = normalizeEmail(body.email);
  const password = validPassword(body.password);
  if (!email || !password) return authError("INVALID_CREDENTIALS", 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = ?")
    .bind(email)
    .first<{ id: string }>();
  if (existing) return authError("EMAIL_IN_USE", 409);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, avatar_url, password_hash, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    ).bind(id, `email:${id}`, email, await hashPassword(password), now, now, now).run();
  } catch {
    return authError("EMAIL_IN_USE", 409);
  }

  const cookie = await createUserSession(env.DB, id);
  return Response.json(
    { user: { id, email, name: null, avatarUrl: null, createdAt: now, lastLoginAt: now } },
    { status: 201, headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } },
  );
}

function authError(code: string, status: number, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return Response.json({ error: { code } }, { status, headers });
}
