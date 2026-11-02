import { connection } from "next/server";
import { convertBuffer } from "@visioncortex/vtracer";
import { assertImageEdges, assertUploadSize, readImageSize, UploadError } from "@/features/assets/inspect";
import { projectError, requireUserId } from "@/features/projects/http";
import { rateLimited, takeRateLimit, TRACE_LIMIT, TRACE_WINDOW_MS } from "@/features/reliability/limits";
import { logEvent } from "@/lib/log";

const MAX_BODY = 8 * 1024 * 1024;

export async function POST(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const advertised = Number(request.headers.get("content-length") ?? 0);
  if (advertised > MAX_BODY) return projectError("upload_too_large", "Files must be 8 MB or smaller.", 413);
  const limit = takeRateLimit(`trace:${userId}`, TRACE_LIMIT, TRACE_WINDOW_MS);
  if (!limit.ok) return rateLimited("Too many traces. Wait a moment and try again.", limit.retryAfterSeconds);
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    assertUploadSize(bytes.byteLength);
    const mimeType = sniffImage(bytes);
    if (!mimeType) return projectError("unsupported_type", "Use a PNG or JPG image.", 422);
    const size = readImageSize(bytes, mimeType);
    assertImageEdges(size.width, size.height);
    const svg = convertBuffer(Buffer.from(bytes), {
      preset: "poster",
      mode: "spline",
      hierarchical: "cutout",
      maxColors: 12,
      filterSpeckle: 4,
      simplify: 1,
    });
    if (!svg.includes("<svg")) return projectError("validation_failed", "That image could not be traced.", 422);
    return new Response(svg, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "x-content-type-options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof UploadError) return projectError(error.code, error.message, error.status);
    logEvent("error", "trace.failed", { message: error instanceof Error ? error.message : "failed" });
    return projectError("validation_failed", "That image could not be traced.", 422);
  }
}

function sniffImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}
