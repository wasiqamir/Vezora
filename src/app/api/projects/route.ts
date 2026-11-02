import { connection } from "next/server";
import { z } from "zod";
import { blankProjectDocument } from "@/features/projects/document";
import { projectError, readJson, requireUserId } from "@/features/projects/http";
import { cleanProjectName, createProject, listProjects } from "@/features/projects/store";
import { createProjectFromTemplate } from "@/features/templates/store";

const createSchema = z.object({
  name: z.string().optional(),
  templateId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const query = (new URL(request.url).searchParams.get("query")?.trim() ?? "").slice(0, 80);
  const projects = await listProjects(userId, query);
  return Response.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const json = await readJson(request);
  if (!json.ok) return projectError("malformed_json", "The request could not be read.", 400);
  const parsed = createSchema.safeParse(json.body);
  if (!parsed.success) return projectError("validation_failed", "That project could not be created.", 422);
  if (parsed.data.templateId) {
    const project = await createProjectFromTemplate(userId, parsed.data.templateId);
    if (!project) return projectError("not_found", "That template was not found.", 404);
    return Response.json(
      { project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() } },
      { status: 201 },
    );
  }
  const name = cleanProjectName(parsed.data.name ?? "Untitled logo");
  if (!name) return projectError("validation_failed", "Enter a project name.", 422);
  const project = await createProject(userId, name, blankProjectDocument(), "save");
  return Response.json(
    { project: { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString() } },
    { status: 201 },
  );
}
