import { connection } from "next/server";
import { projectError, requireUserId } from "@/features/projects/http";
import { isResourceId } from "@/features/reliability/limits";
import { createProjectFromTemplate } from "@/features/templates/store";

type Context = { params: Promise<{ templateId: string }> };

export async function POST(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { templateId } = await context.params;
  if (!isResourceId(templateId) && !/^[a-z0-9-]{1,80}$/.test(templateId)) {
    return projectError("not_found", "That template was not found.", 404);
  }
  const project = await createProjectFromTemplate(userId, templateId);
  if (!project) return projectError("not_found", "That template was not found.", 404);
  return Response.json(
    { project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() } },
    { status: 201 },
  );
}
