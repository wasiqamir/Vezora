import { connection } from "next/server";
import { projectError, requireUserId } from "@/features/projects/http";
import { categoryFromQuery, listPublishedTemplates } from "@/features/templates/store";

export async function GET(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const url = new URL(request.url);
  const category = categoryFromQuery(url.searchParams.get("category"));
  const query = (url.searchParams.get("query")?.trim() ?? "").slice(0, 80);
  const requested = url.searchParams.get("category");
  if (requested && requested !== "All" && !category) {
    return projectError("validation_failed", "That category was not found.", 422);
  }
  const templates = await listPublishedTemplates(category, query);
  return Response.json({
    templates: templates.map((template) => ({
      id: template.id,
      slug: template.slug,
      name: template.name,
      category: template.category,
      description: template.description,
      schemaVersion: template.schemaVersion,
    })),
  });
}
