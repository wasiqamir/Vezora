import { after, connection } from "next/server";
import { z } from "zod";
import { projectError, readJson, requireUserId } from "@/features/projects/http";
import { createReconstructionJob, enqueueReconstruction, ReconstructionError } from "@/features/reconstruction/jobs";
import { isResourceId, rateLimited, RECONSTRUCTION_LIMIT, RECONSTRUCTION_WINDOW_MS, takeRateLimit } from "@/features/reliability/limits";

const bodySchema = z.object({
  projectId: z.string().min(1).max(80),
  assetId: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const json = await readJson(request);
  if (!json.ok) return projectError("malformed_json", "The request could not be read.", 400);
  const parsed = bodySchema.safeParse(json.body);
  if (!parsed.success) return projectError("validation_failed", "Choose a PNG or JPG to reconstruct.", 422);
  if (!isResourceId(parsed.data.projectId) || !isResourceId(parsed.data.assetId)) {
    return projectError("not_found", "That project was not found.", 404);
  }
  const limit = takeRateLimit(`reconstruction:${userId}`, RECONSTRUCTION_LIMIT, RECONSTRUCTION_WINDOW_MS);
  if (!limit.ok) {
    return rateLimited("Too many reconstructions. Wait a moment and try again.", limit.retryAfterSeconds);
  }
  try {
    const job = await createReconstructionJob(userId, parsed.data.projectId, parsed.data.assetId);
    after(() => enqueueReconstruction(job.id));
    return Response.json({ job: { id: job.id, status: job.status } }, { status: 202 });
  } catch (error) {
    if (error instanceof ReconstructionError) return projectError(error.code, error.message, error.status);
    throw error;
  }
}
