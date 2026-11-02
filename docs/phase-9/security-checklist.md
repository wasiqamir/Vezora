# Phase 9 security checklist

Checked against the routes in this app. A missing row and another user's row both return 404 with `{ error: { code, message } }`. They do not return 403.

| Check | Result |
|---|---|
| Projects, versions, duplicates | Loaded with `ownerId`. Other users get 404. |
| Uploads | Owner can read. `ownerId` null (system files) can be read by any signed-in user. Another user's id is 404. |
| Reconstruction jobs | Created and read only for the owner. Another user's job id is 404. |
| Templates | Signed-in users can list and copy published templates. There is no public edit API. |
| Trace | Requires a signed-in user. PNG and JPG only, same size and edge limits as uploads. |
| Ids | Route ids must be 1–80 letters, numbers, `_`, or `-`. Anything else is 404 and is not queried. |
| Payloads | JSON bodies are parsed and checked with Zod. Project documents must be schema version 1. |
| Uploads | PNG, JPG, or SVG on the canvas. Reconstruction accepts PNG and JPG only. Max 8 MB. Edges 64–4096. |
| Rate limits | 30 uploads, 20 reconstructions, and 20 traces per user per 10 minutes. Extra calls return 429 `rate_limited` and `Retry-After`. |
| Job concurrency | One queued or running reconstruction per user. A second start returns 429 `too_many_jobs`. |
| Processing | One reconstruction runs at a time in this server process. Images over 4096×4096 pixels are rejected. A run longer than 90 seconds is logged. |
| SVG | Served as `image/svg+xml` with `nosniff`. Untrusted SVG is not inlined into the app HTML. |
| Logs | Failures are one JSON line: time, level, event, ids, and a short message. Passwords, file bytes, and project JSON are not logged. |
| Health | `GET /api/health` returns 503 and logs `health.database_down` when the database cannot be reached. |

`src/features/projects/access.test.ts` creates two users and checks that the second cannot read, delete, or see the first user's project, upload, or job.
