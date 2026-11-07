import { connection } from "next/server";
import {
  assertCanvasType,
  assertImageEdges,
  assertUploadSize,
  readImageSize,
  UploadError,
} from "@/features/assets/inspect";
import { projectError } from "@/features/projects/http";
import { buildReconstructionDraft } from "@/features/reconstruction/draft";
import {
  MAX_PIXELS,
  rateLimited,
  RECONSTRUCTION_LIMIT,
  RECONSTRUCTION_WINDOW_MS,
  takeRateLimit,
} from "@/features/reliability/limits";
import { logEvent } from "@/lib/log";

export const maxDuration = 60;

const MAX_BODY = 8 * 1024 * 1024 + 64 * 1024;

/** Guest Start-from-image draft: no account project — returns an editable document + asset id. */
export async function POST(request: Request) {
  await connection();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "guest";
  const limit = takeRateLimit(`reconstruction:guest:${forwarded}`, RECONSTRUCTION_LIMIT, RECONSTRUCTION_WINDOW_MS);
  if (!limit.ok) {
    return rateLimited("Too many reconstructions. Wait a moment and try again.", limit.retryAfterSeconds);
  }

  const advertised = Number(request.headers.get("content-length") ?? 0);
  if (advertised > MAX_BODY) return projectError("upload_too_large", "Files must be 8 MB or smaller.", 413);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return projectError("validation_failed", "Choose an image file.", 422);
    }
    assertCanvasType(file.type);
    assertUploadSize(file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertUploadSize(bytes.byteLength);
    const size = readImageSize(bytes, file.type);
    assertImageEdges(size.width, size.height);
    if (size.width * size.height > MAX_PIXELS) {
      return projectError("validation_failed", "That image is too large to reconstruct.", 422);
    }

    const assetId = `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const jobId = `guest_${assetId}`.slice(0, 80);
    // Fast trace + short OCR so Edit elements opens editable marks and live words without hanging.
    const draft = await buildReconstructionDraft({
      bytes,
      mimeType: file.type || "image/png",
      assetId,
      jobId,
      ocrTimeoutMs: 4_000,
      maxEdge: 960,
      fastOcr: true,
    });

    return Response.json({
      asset: { id: assetId, width: size.width, height: size.height, mimeType: file.type || "image/png" },
      document: draft.document,
      recovered: draft.recovered,
    });
  } catch (error) {
    if (error instanceof UploadError) return projectError(error.code, error.message, error.status);
    logEvent("error", "reconstruction.guest.failed", {
      message: error instanceof Error ? error.message : "failed",
    });
    return projectError("reconstruction_failed", "Could not build a draft from this image.", 500);
  }
}
