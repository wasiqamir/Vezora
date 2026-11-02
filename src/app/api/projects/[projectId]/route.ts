import { connection } from "next/server";
import { z } from "zod";
import { projectError, readJson, requireUserId } from "@/features/projects/http";
import { isResourceId } from "@/features/reliability/limits";
import { cleanProjectName, deleteProject, getOwnedProject, renameProject } from "@/features/projects/store";

const renameSchema = z.object({
  name: z.string(),
});

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const project = await getOwnedProject(userId, projectId);
  if (!project) return projectError("not_found", "That project was not found.", 404);
  return Response.json({
    project: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      updatedAt: project.updatedAt.toISOString(),
      document: project.document,
    },
  });
}

export async function PATCH(request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const json = await readJson(request);
  if (!json.ok) return projectError("malformed_json", "The request could not be read.", 400);
  const parsed = renameSchema.safeParse(json.body);
  if (!parsed.success) return projectError("validation_failed", "Enter a project name.", 422);
  const name = cleanProjectName(parsed.data.name);
  if (!name) return projectError("validation_failed", "Enter a project name.", 422);
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const project = await renameProject(userId, projectId, name);
  if (!project) return projectError("not_found", "That project was not found.", 404);
  return Response.json({
    project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() },
  });
}

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const deleted = await deleteProject(userId, projectId);
  if (!deleted) return projectError("not_found", "That project was not found.", 404);
  return new Response(null, { status: 204 });
}
