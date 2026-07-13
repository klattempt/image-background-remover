import { NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "batch_created",
  "batch_started",
  "image_succeeded",
  "image_failed",
  "image_downloaded",
  "batch_completed",
  "batch_cleared",
]);

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response(null, { status: 403 });
  try {
    const body = (await request.json()) as { event?: unknown; properties?: unknown };
    if (typeof body.event !== "string" || !ALLOWED_EVENTS.has(body.event)) {
      return new Response(null, { status: 400 });
    }
    const properties =
      body.properties && typeof body.properties === "object" ? body.properties : {};
    console.info(JSON.stringify({ type: "product_event", event: body.event, properties }));
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 400 });
  }
}
