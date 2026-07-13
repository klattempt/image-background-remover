import { apiError } from "@/lib/api-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  clientIp,
  getBatchSecret,
  isAllowedOrigin,
  verifyBatchToken,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;
const encoder = new TextEncoder();

function buildMultipartStream(
  source: ReadableStream<Uint8Array>,
  contentType: string,
  boundary: string,
) {
  const prefix = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="size"\r\n\r\nauto\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="format"\r\n\r\npng\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="type"\r\n\r\nproduct\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image_file"; filename="upload.bin"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const reader = source.getReader();
  let phase: "prefix" | "body" | "suffix" | "done" = "prefix";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (phase === "prefix") {
        controller.enqueue(prefix);
        phase = "body";
        return;
      }
      if (phase === "body") {
        const chunk = await reader.read();
        if (!chunk.done) {
          controller.enqueue(chunk.value);
          return;
        }
        phase = "suffix";
      }
      if (phase === "suffix") {
        controller.enqueue(suffix);
        phase = "done";
        return;
      }
      controller.close();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return { stream, overhead: prefix.byteLength + suffix.byteLength };
}

async function readLimitedText(response: Response, maximum = 16 * 1024) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maximum) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maximum - size;
    const part = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(part);
    size += part.byteLength;
    if (part.byteLength < value.byteLength) break;
  }
  await reader.cancel();
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return apiError("INVALID_REQUEST", 403);

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const secret = getBatchSecret();
  if (!secret || !token || !(await verifyBatchToken(token, secret))) {
    return apiError("BATCH_AUTH_REQUIRED", 401);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) return apiError("INVALID_FILE_TYPE", 415);

  const rawLength = request.headers.get("content-length");
  if (!rawLength) return apiError("INVALID_REQUEST", 411);
  const contentLength = Number(rawLength);
  if (!Number.isInteger(contentLength) || contentLength <= 0) {
    return apiError("INVALID_REQUEST", 400);
  }
  if (contentLength > MAX_BYTES) return apiError("FILE_TOO_LARGE", 413);
  if (!request.body) return apiError("INVALID_REQUEST", 400);

  const ip = clientIp(request);
  const rateLimit = consumeRateLimit(
    `remove:${ip}`,
    Number(process.env.MAX_REQUESTS_PER_HOUR ?? 60),
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", 429, rateLimit.retryAfter);

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return apiError("CONFIGURATION_ERROR", 503);

  const boundary = `----image-bg-${crypto.randomUUID()}`;
  const multipart = buildMultipartStream(request.body, contentType, boundary);

  let upstream: Response;
  try {
    const init = {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(contentLength + multipart.overhead),
      },
      body: multipart.stream,
      cache: "no-store",
      duplex: "half",
    } as RequestInit & { duplex: "half" };
    upstream = await fetch("https://api.remove.bg/v1.0/removebg", init);
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

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
