import {
  authFailure,
  googleRedirectUri,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  randomToken,
  readCookie,
  secureCookie,
  SESSION_COOKIE,
  SESSION_SECONDS,
  sha256,
} from "../../_shared/auth";
import type { FunctionContext } from "../../_shared/types";

type TokenResponse = { access_token?: string };
type GoogleUser = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function onRequestGet({ request, env }: FunctionContext) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return authFailure(request, "invalid_state");
  }
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return authFailure(request, "not_configured");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(request, env),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) return authFailure(request, "token_exchange_failed");
    const token = (await tokenResponse.json()) as TokenResponse;
    if (!token.access_token) return authFailure(request, "token_exchange_failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) return authFailure(request, "profile_failed");
    const profile = (await profileResponse.json()) as GoogleUser;
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      return authFailure(request, "unverified_email");
    }

    const now = new Date().toISOString();
    let user = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?")
      .bind(profile.sub)
      .first<{ id: string }>();
    user ??= await env.DB.prepare("SELECT id FROM users WHERE lower(email) = ?")
      .bind(profile.email.toLowerCase())
      .first<{ id: string }>();

    if (user) {
      await env.DB.prepare(
        `UPDATE users SET google_sub = ?, email = ?, name = ?, avatar_url = ?,
         updated_at = ?, last_login_at = ? WHERE id = ?`,
      ).bind(
        profile.sub,
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        now,
        now,
        user.id,
      ).run();
    } else {
      user = { id: crypto.randomUUID() };
      await env.DB.prepare(
        `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        user.id,
        profile.sub,
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        now,
        now,
        now,
      ).run();
    }
    if (!user) return authFailure(request, "database_failed");

    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), user.id, await sha256(sessionToken), expiresAt, now).run();

    const returnTo = readCookie(request, OAUTH_RETURN_COOKIE) === "/account" ? "/account" : "/";
    const headers = new Headers({
      Location: new URL(returnTo, request.url).toString(),
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", secureCookie(SESSION_COOKIE, sessionToken, SESSION_SECONDS));
    headers.append("Set-Cookie", secureCookie(OAUTH_STATE_COOKIE, "", 0));
    headers.append("Set-Cookie", secureCookie(OAUTH_RETURN_COOKIE, "", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return authFailure(request, "login_failed");
  }
}
