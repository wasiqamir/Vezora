import { connection } from "next/server";
import { readUpload } from "@/features/assets/storage";
import { projectError, requireUserId } from "@/features/projects/http";
import { isResourceId } from "@/features/reliability/limits";
import { getPrisma } from "@/lib/db";

type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { assetId } = await context.params;
  if (!isResourceId(assetId)) return projectError("not_found", "That file was not found.", 404);
  const asset = await getPrisma().asset.findFirst({
    where: {
      id: assetId,
      OR: [{ ownerId: userId }, { ownerId: null }],
    },
    select: { id: true, mimeType: true, storageKey: true, ownerId: true },
  });
  if (!asset || !asset.storageKey.startsWith("uploads/")) {
    return projectError("not_found", "That file was not found.", 404);
  }
  try {
    const bytes = await readUpload(asset.id);
    return new Response(bytes, {
      headers: {
        "content-type": asset.mimeType,
        "cache-control": "private, max-age=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return projectError("not_found", "That file was not found.", 404);
  }
}
