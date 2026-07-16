import { readCookie, SESSION_COOKIE, secureCookie, sha256 } from "../../_shared/auth";
import type { FunctionContext } from "../../_shared/types";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
  authProvider: string;
  plan: string | null;
  creditsRemaining: number | null;
  creditsTotal: number | null;
  validUntil: string | null;
};

export async function onRequestGet({ request, env }: FunctionContext) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !env.DB) {
    return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.avatar_url AS avatarUrl,
            users.created_at AS createdAt, users.last_login_at AS lastLoginAt,
            CASE
              WHEN users.password_hash IS NOT NULL AND users.google_sub NOT LIKE 'email:%' THEN 'Email + Google'
              WHEN users.password_hash IS NOT NULL THEN 'Email account'
              ELSE 'Google account'
            END AS authProvider,
            user_credits.plan, user_credits.credits_remaining AS creditsRemaining,
            user_credits.credits_total AS creditsTotal, user_credits.valid_until AS validUntil
     FROM sessions JOIN users ON users.id = sessions.user_id
     LEFT JOIN user_credits ON user_credits.user_id = users.id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<UserRow>();

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (!user) headers["Set-Cookie"] = secureCookie(SESSION_COOKIE, "", 0);
  if (user?.validUntil && new Date(user.validUntil).getTime() <= Date.now()) {
    user.creditsRemaining = 0;
  }
  return Response.json({ user }, { headers });
}
