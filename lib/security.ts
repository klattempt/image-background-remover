const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type BatchClaims = {
  batchId: string;
  count: number;
  userId?: string;
  issuedAt: number;
  expiresAt: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createBatchToken(count: number, secret: string, userId?: string) {
  const now = Math.floor(Date.now() / 1000);
  const claims: BatchClaims = {
    batchId: crypto.randomUUID(),
    count,
    ...(userId ? { userId } : {}),
    issuedAt: now,
    expiresAt: now + 10 * 60,
  };
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return { token: `${payload}.${bytesToBase64Url(signature)}`, claims };
}

export async function verifyBatchToken(token: string, secret: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  try {
    const key = await importHmacKey(secret);
    const signatureBytes = Uint8Array.from(base64UrlToBytes(signature));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payload),
    );
    if (!valid) return null;

    const claims = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as BatchClaims;
    const now = Math.floor(Date.now() / 1000);
    if (
      !claims.batchId ||
      !Number.isInteger(claims.count) ||
      claims.count < 1 ||
      claims.count > 20 ||
      claims.expiresAt <= now ||
      claims.issuedAt > now + 30
    ) {
      return null;
    }
    if (claims.userId !== undefined && (typeof claims.userId !== "string" || !claims.userId)) return null;
    return claims;
  } catch {
    return null;
  }
}

export type SecurityEnv = {
  APP_ORIGIN?: string;
  BATCH_SIGNING_SECRET?: string;
};

export function getBatchSecret(env: SecurityEnv) {
  return env.BATCH_SIGNING_SECRET ?? null;
}

export function isAllowedOrigin(request: Request, env: SecurityEnv) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (!origin) return url.hostname === "localhost" || url.hostname === "127.0.0.1";

  const explicitOrigin = env.APP_ORIGIN?.replace(/\/$/u, "");
  if (explicitOrigin) return origin === explicitOrigin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const expected = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : url.origin;
  return origin === expected;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
