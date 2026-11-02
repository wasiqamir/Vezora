# Logo Creation Tool

Next.js app for designing logos. Phase 1 is the foundation: routes, shared UI, and a PostgreSQL database through Prisma.

## Local setup

Node.js 20 or newer is required.

```powershell
npm install
npm run db:dev
```

Copy the `DATABASE_URL` and `SHADOW_DATABASE_URL` printed by that command into `.env`, using `.env.example` as the list of variables. Then, in a second terminal:

```powershell
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000. The health check is http://localhost:3000/api/health.

`npm run db:dev` starts a local PostgreSQL server for development. It does not require Docker. Production should use a managed PostgreSQL database and the same Prisma schema.

## Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

Do not commit `.env`.
