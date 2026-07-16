import { consumeRateLimit } from "../../../lib/rate-limit";
import { clientIp, isAllowedOrigin } from "../../../lib/security";
import { createUserSession, normalizeEmail, verifyPassword } from "../../_shared/credentials";
import type { FunctionContext } from "../../_shared/types";

type LoginBody = { email?: unknown; password?: unknown };
type LoginUser = { id: string; passwordHash: string | null };

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return authError("INVALID_REQUEST", 403);
  if (!env.DB) return authError("NOT_CONFIGURED", 503);

  const rate = consumeRateLimit(`auth-login:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) return authError("RATE_LIMITED", 429, rate.retryAfter);

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return authError("INVALID_REQUEST", 400);
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return authError("INVALID_CREDENTIALS", 401);

  const user = await env.DB.prepare(
    "SELECT id, password_hash AS passwordHash FROM users WHERE lower(email) = ?",
  ).bind(email).first<LoginUser>();
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return authError("INVALID_CREDENTIALS", 401);
  }

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET updated_at = ?, last_login_at = ? WHERE id = ?")
    .bind(now, now, user.id)
    .run();
  const cookie = await createUserSession(env.DB, user.id);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

function authError(code: string, status: number, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return Response.json({ error: { code } }, { status, headers });
}
