import { readCookie, SESSION_COOKIE, secureCookie, sha256 } from "../../_shared/auth";
import { isAllowedOrigin } from "../../../lib/security";
import type { FunctionContext } from "../../_shared/types";

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return new Response(null, { status: 403 });
  const token = readCookie(request, SESSION_COOKIE);
  if (token && env.DB) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": secureCookie(SESSION_COOKIE, "", 0),
      "Cache-Control": "no-store",
    },
  });
}
