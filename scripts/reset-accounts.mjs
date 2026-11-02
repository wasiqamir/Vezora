import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("postgres")) {
  console.error("DATABASE_URL is not a usable connection string");
  process.exit(1);
}

let hostname = "";
try {
  hostname = new URL(url).hostname;
} catch {
  console.error("DATABASE_URL is not a usable connection string");
  process.exit(1);
}

if (hostname === "localhost" || hostname === "127.0.0.1") {
  console.error("This reset is for the production database only");
  process.exit(1);
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : "reset failed";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
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
  console.log(
    JSON.stringify({
      database: hostname.includes("neon") ? "production" : "remote",
      usersRemoved: users.rowCount,
      projectsClearedWithAccounts: true,
      jobsRemoved: jobs.rowCount,
      uploadsRemoved: assets.rowCount,
      usersLeft: left.rows[0].users,
      projectsLeft: left.rows[0].projects,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  const code = error && typeof error === "object" ? error.code : undefined;
  if (code === "42P01") {
    console.log(JSON.stringify({ usersRemoved: 0, empty: true }));
  } else {
    console.error(safeMessage(error));
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
