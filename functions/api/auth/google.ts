import { googleRedirectUri, OAUTH_STATE_COOKIE, randomToken, secureCookie } from "../../_shared/auth";
import type { FunctionContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: FunctionContext) {
  if (!env.GOOGLE_CLIENT_ID) return new Response("Google login is not configured.", { status: 503 });

  const state = randomToken();
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorization.searchParams.set("redirect_uri", googleRedirectUri(request, env));
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorization.toString(),
      "Set-Cookie": secureCookie(OAUTH_STATE_COOKIE, state, 600),
      "Cache-Control": "no-store",
    },
  });
}
