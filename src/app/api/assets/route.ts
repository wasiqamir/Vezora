import { connection } from "next/server";
import { fontLibrary, iconLibrary } from "@/features/assets/library";
import { projectError, requireUserId } from "@/features/projects/http";

export async function GET(request: Request) {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "icon") return Response.json({ assets: iconLibrary() });
  if (kind === "font") return Response.json({ assets: fontLibrary() });
  return projectError("validation_failed", "Choose icon or font.", 422);
}
