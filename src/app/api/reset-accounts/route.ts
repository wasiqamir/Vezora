import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "reset failed";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

export async function POST(request: Request) {
  const expected = process.env.RESET_TOKEN;
  const provided = request.headers.get("x-reset-token");
  if (!expected || provided !== expected) return new NextResponse(null, { status: 404 });

  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) {
    return NextResponse.json({ error: "database-unavailable" }, { status: 500 });
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "database-unavailable" }, { status: 500 });
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return NextResponse.json({ error: "refused-local" }, { status: 500 });
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    const jobs = await client.query('DELETE FROM "ReconstructionJob"');
    const assets = await client.query(`
      DELETE FROM "Asset" AS asset
      WHERE (asset."ownerId" IS NOT NULL OR asset."projectId" IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM "Template" AS template
          WHERE template."previewAssetId" = asset."id"
        )
    `);
    const users = await client.query('DELETE FROM "User"');
    const left = await client.query(
      'SELECT (SELECT COUNT(*)::int FROM "User") AS users, (SELECT COUNT(*)::int FROM "Project") AS projects',
    );
    await client.query("COMMIT");
    return NextResponse.json({
      database: hostname.includes("neon") ? "production" : "remote",
      usersRemoved: users.rowCount,
      jobsRemoved: jobs.rowCount,
      uploadsRemoved: assets.rowCount,
      usersLeft: left.rows[0].users,
      projectsLeft: left.rows[0].projects,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "42P01") return NextResponse.json({ usersRemoved: 0, empty: true });
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  } finally {
    await client.end();
  }
}
