# Phase 9 deletion, backup, and recovery

This app keeps data in PostgreSQL and uploaded bytes in `storage/uploads` on the same machine. A backup is useful only when those two are saved together. An asset id in the database must match a file name in that folder.

## What a user can delete

Deleting a project sets `deletedAt`. The project leaves the owner's list. The database row, its versions, and uploaded files stay. Another user still cannot open it. There is no account-deletion screen in this version.

## Backup

1. Stop writes, or accept that a dump taken during a save can miss the last second.
2. Dump the database: `pg_dump` of the `DATABASE_URL` database.
3. Copy the `storage/uploads` directory.
4. Store the dump and the folder together, with the same timestamp.

Do not put `.env` in the same public place as the dump. It contains `AUTH_SECRET` and `DATABASE_URL`.

## Recovery

1. Restore the database dump into an empty database and point `DATABASE_URL` at it.
2. Replace `storage/uploads` with the copy from the same backup.
3. Run `npm run dev` or the production server and open `GET /api/health`. It should return `{ "ok": true, "database": "up" }`.
4. Sign in and open a project that had an uploaded image. The canvas loads that image from `GET /api/uploads/:id`.

If the database is restored without the upload folder, projects open and the locked Original layer is missing. If the folder is restored without the database, the files cannot be opened because the asset ids are gone.

## When a reconstruction fails

The job row stores `failed`, `errorCode`, and `errorMessage`. The server also writes a JSON log line `reconstruction.finish`. The original file remains in `storage/uploads`. The editor can still show it as the locked Original layer.

A restart does not resume a reconstruction that was still queued. Start it again from the editor. The upload is still stored.

## When the database is down

`GET /api/health` returns 503 and logs `health.database_down`. Sign-in and saves fail until the database is back. Uploaded files on disk are unchanged.
