import "dotenv/config";
import { defineConfig } from "prisma/config";

// Generate only needs a URL string. The running app still requires DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5432/vezora";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
