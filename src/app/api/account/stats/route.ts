import { connection } from "next/server";
import { projectError, requireUserId } from "@/features/projects/http";
import { listAccountDesigns } from "@/features/projects/store";

/** Fresh Logos / Saves / Shared counts for the account page (no full reload). */
export async function GET() {
  await connection();
  const userId = await requireUserId();
  if (!userId) return projectError("unauthorized", "Sign in to continue.", 401);
  const designs = await listAccountDesigns(userId);
  return Response.json(
    {
      stats: {
        logos: designs.filter((design) => design.exported).length,
        saves: designs.reduce((total, design) => total + design.saves, 0),
        shared: designs.filter((design) => design.shared).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
