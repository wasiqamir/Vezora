import { connection } from "next/server";
import { z } from "zod";
import { migrateDocument, ProjectDocumentError } from "@/features/projects/document";
import { projectError, readJson, requireUserId } from "@/features/projects/http";
import { isResourceId } from "@/features/reliability/limits";
import { saveProjectDocument } from "@/features/projects/store";

const saveSchema = z.object({
  document: z.unknown(),
  source: z.enum(["save", "autosave"]),
});

type Context = { params: Promise<{ projectId: string }> };

export async function PUT(request: Request, context: Context) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const json = await readJson(request);
  if (!json.ok) return projectError("malformed_json", "The request could not be read.", 400);
  const parsed = saveSchema.safeParse(json.body);
  if (!parsed.success) return projectError("validation_failed", "That project could not be saved.", 422);
  let document;
  try {
    document = migrateDocument(parsed.data.document);
  } catch (error) {
    if (error instanceof ProjectDocumentError) return projectError(error.code, error.message, 422);
    throw error;
  }
  const { projectId } = await context.params;
  if (!isResourceId(projectId)) return projectError("not_found", "That project was not found.", 404);
  const project = await saveProjectDocument(userId, projectId, document, parsed.data.source);
  if (!project) return projectError("not_found", "That project was not found.", 404);
  return Response.json({
    project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() },
  });
}
