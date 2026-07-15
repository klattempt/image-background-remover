import type { AppEnv } from "./types";

export const SESSION_COOKIE = "__Host-cutline_session";
export const OAUTH_STATE_COOKIE = "__Host-cutline_oauth_state";
export const OAUTH_RETURN_COOKIE = "__Host-cutline_oauth_return";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function googleRedirectUri(request: Request, env: AppEnv) {
  return env.GOOGLE_REDIRECT_URI ?? `${new URL(request.url).origin}/api/auth/callback`;
}

export function authFailure(request: Request, reason: string) {
  const target = new URL("/", request.url);
  target.searchParams.set("auth_error", reason);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": secureCookie(OAUTH_STATE_COOKIE, "", 0),
      "Cache-Control": "no-store",
    },
  });
}
