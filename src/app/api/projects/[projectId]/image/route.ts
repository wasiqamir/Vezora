import { connection } from "next/server";
import { decodeLogoImage } from "@/features/assets/logo-image";
import { projectError, requireUserId } from "@/features/projects/http";
import { storeProjectLogo } from "@/features/projects/store";
import { isResourceId, rateLimited, takeRateLimit, UPLOAD_LIMIT, UPLOAD_WINDOW_MS } from "@/features/reliability/limits";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const limit = takeRateLimit(`logo-image:${userId}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!limit.ok) return rateLimited("Too many logo images. Wait a moment and try again.", limit.retryAfterSeconds);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 2_500_000) {
    return projectError("validation_failed", "That logo image could not be stored.", 422);
  }
  const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
  const image = decodeLogoImage(encoded);
  if (!image) return projectError("validation_failed", "That logo image could not be stored.", 422);
  const url = await storeProjectLogo(userId, projectId, image);
  if (url == null) return projectError("not_found", "That project was not found.", 404);
  return Response.json({ imageUrl: url || null });
}
