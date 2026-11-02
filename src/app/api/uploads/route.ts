import { connection } from "next/server";
import {
  assertCanvasType,
  assertImageEdges,
  assertUploadSize,
  readImageSize,
  UploadError,
} from "@/features/assets/inspect";
import { uploadStorageKey, writeUpload } from "@/features/assets/storage";
import { projectError, requireUserId } from "@/features/projects/http";
import { rateLimited, takeRateLimit, UPLOAD_LIMIT, UPLOAD_WINDOW_MS } from "@/features/reliability/limits";
import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";

const MAX_BODY = 8 * 1024 * 1024 + 64 * 1024;

export async function POST(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const advertised = Number(request.headers.get("content-length") ?? 0);
  if (advertised > MAX_BODY) return projectError("upload_too_large", "Files must be 8 MB or smaller.", 413);
  const limit = takeRateLimit(`upload:${userId}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!limit.ok) return rateLimited("Too many uploads. Wait a moment and try again.", limit.retryAfterSeconds);
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
    const prisma = getPrisma();
    const asset = await prisma.asset.create({
      data: {
        ownerId: userId,
        kind: "upload",
        storageKey: "pending",
        mimeType: file.type,
        byteSize: bytes.byteLength,
        width: size.width,
        height: size.height,
        licenseName: "User upload",
        sourceName: "User",
      },
      select: { id: true, mimeType: true, width: true, height: true, byteSize: true },
    });
    await writeUpload(asset.id, bytes);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey: uploadStorageKey(asset.id) },
    });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return projectError(error.code, error.message, error.status);
    logEvent("error", "upload.failed", { message: error instanceof Error ? error.message : "failed" });
    throw error;
  }
}
