import { connection } from "next/server";
import { pingDatabase } from "@/lib/db";
import { logEvent } from "@/lib/log";

export async function GET() {
  await connection();
  const up = await pingDatabase();

  if (!up) {
    logEvent("error", "health.database_down", {});
    return Response.json({ ok: false, database: "down" }, { status: 503 });
  }

  return Response.json({ ok: true, database: "up" });
}
