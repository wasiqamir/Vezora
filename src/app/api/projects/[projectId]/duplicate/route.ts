import { connection } from "next/server";
import { projectError, requireUserId } from "@/features/projects/http";
import { isResourceId } from "@/features/reliability/limits";
import { duplicateProject } from "@/features/projects/store";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const project = await duplicateProject(userId, projectId);
  if (!project) return projectError("not_found", "That project was not found.", 404);
  return Response.json(
    { project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() } },
    { status: 201 },
  );
}
