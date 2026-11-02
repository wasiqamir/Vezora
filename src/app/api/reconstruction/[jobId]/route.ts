import { connection } from "next/server";
import { projectError, requireUserId } from "@/features/projects/http";
import { getReconstructionJob } from "@/features/reconstruction/jobs";
import { isResourceId } from "@/features/reliability/limits";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { jobId } = await context.params;
  if (!isResourceId(jobId)) return projectError("not_found", "That reconstruction was not found.", 404);
  const job = await getReconstructionJob(userId, jobId);
  if (!job) return projectError("not_found", "That reconstruction was not found.", 404);
  return Response.json({ job });
}
