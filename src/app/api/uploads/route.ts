import { connection } from "next/server";
import {
  assertCanvasType,
  assertImageEdges,
  assertUploadSize,
  readImageSize,
  UploadError,
} from "@/features/assets/inspect";
import { writeUpload } from "@/features/assets/storage";
import { projectError, requireUserId } from "@/features/projects/http";
import { rateLimited, takeRateLimit, UPLOAD_LIMIT, UPLOAD_WINDOW_MS } from "@/features/reliability/limits";
import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";

export async function POST(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const limit = takeRateLimit(`upload:${userId}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!limit.ok) return rateLimited("Too many uploads. Wait a moment and try again.", limit.retryAfterSeconds);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return projectError("validation_failed", "Choose an image file.", 422);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertUploadSize(bytes.byteLength);
    const mimeType =
      file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/svg+xml"
        ? file.type
        : sniffUploadMime(bytes);
    assertCanvasType(mimeType);
    const size = readImageSize(bytes, mimeType);
    assertImageEdges(size.width, size.height);
    const prisma = getPrisma();
    const asset = await prisma.asset.create({
      data: {
        ownerId: userId,
        kind: "upload",
        storageKey: "pending",
        mimeType,
        byteSize: bytes.byteLength,
        width: size.width,
        height: size.height,
        licenseName: "User upload",
        sourceName: "User",
      },
      select: { id: true, mimeType: true, width: true, height: true, byteSize: true },
    });
    const storageKey = await writeUpload(asset.id, bytes, mimeType);
    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey },
      select: { id: true, mimeType: true, width: true, height: true, byteSize: true },
    });
    return Response.json({ asset: updated }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return projectError(error.code, error.message, error.status);
    const message = error instanceof Error ? error.message : "failed";
    logEvent("error", "upload.failed", { message });
    return projectError(
      "upload_failed",
      message.startsWith("Could not store") ? message : "That image could not be uploaded.",
      500,
    );
  }
}

function sniffUploadMime(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "application/octet-stream";
}
