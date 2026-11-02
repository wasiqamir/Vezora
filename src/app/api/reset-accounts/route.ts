import { readFileSync } from "node:fs";
import path from "node:path";
import { connection, NextResponse } from "next/server";
import pg from "pg";
import { databaseUrlCandidates, databaseUrlReport } from "@/lib/database-url";

const MIGRATIONS = [
  "prisma/migrations/20261024195503_init/migration.sql",
  "prisma/migrations/20261101154000_project_share_token/migration.sql",
];

function statements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

function failureCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "connect-failed";
}

async function ensureSchema(client: pg.Client) {
  const ready = await client.query(`SELECT to_regclass('"User"') AS name`);
  if (ready.rows[0]?.name) return false;
  for (const file of MIGRATIONS) {
    const sql = readFileSync(path.join(process.cwd(), file), "utf8");
    for (const statement of statements(sql)) {
      try {
        await client.query(statement);
      } catch (error) {
        const code = failureCode(error);
        if (code !== "42710" && code !== "42P07" && code !== "42701") throw error;
      }
    }
  }
  return true;
}

async function clearAccounts(client: pg.Client) {
  await client.query("BEGIN");
  try {
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
    return {
      usersRemoved: users.rowCount,
      jobsRemoved: jobs.rowCount,
      uploadsRemoved: assets.rowCount,
      usersLeft: left.rows[0].users,
      projectsLeft: left.rows[0].projects,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function POST(request: Request) {
  await connection();
  const expected = process.env.RESET_TOKEN;
  const provided = request.headers.get("x-reset-token");
  if (!expected || provided !== expected) return new NextResponse(null, { status: 404 });

  const failures: { name: string; code: string }[] = [];
  for (const candidate of databaseUrlCandidates()) {
    let hostname = "";
    try {
      hostname = new URL(candidate.url).hostname;
    } catch {
      failures.push({ name: candidate.name, code: "unparsed" });
      continue;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      failures.push({ name: candidate.name, code: "refused-local" });
      continue;
    }

    const client = new pg.Client({
      connectionString: candidate.url,
      ssl: candidate.url.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      const createdSchema = await ensureSchema(client);
      const cleared = await clearAccounts(client);
      return NextResponse.json({ source: candidate.name, createdSchema, ...cleared });
    } catch (error) {
      failures.push({ name: candidate.name, code: failureCode(error) });
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  return NextResponse.json(
    { error: "database-unavailable", checked: databaseUrlReport(), failures },
    { status: 500 },
  );
}
