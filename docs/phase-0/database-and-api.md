# Database and API outline

**Status:** Locked for Phase 1.

Phase 1 may rename a column or add an index. It may not add an entity that implies teams, billing, or sharing. Project documents use `schemaVersion: 1`.

Binary files live in object storage. The database stores the storage key and metadata. Project JSON stores an asset id, not the file bytes.

## Entities

```text
User
  id, email (unique), name, passwordHash, createdAt, updatedAt

Project
  id, ownerId -> User
  name, schemaVersion
  createdAt, updatedAt, deletedAt

ProjectVersion
  id, projectId -> Project
  number (unique per project)
  document (JSON)
  source: "save" | "autosave" | "duplicate" | "template" | "reconstruction"
  createdAt

Template
  id, slug (unique), name, category, description
  document (JSON), schemaVersion
  previewAssetId -> Asset, nullable
  published

Asset
  id
  ownerId -> User, nullable for system assets
  projectId -> Project, nullable
  kind: "upload" | "preview" | "icon" | "font"
  storageKey, mimeType, byteSize, width, height
  licenseName, sourceName
  createdAt

ReconstructionJob
  id, ownerId -> User, projectId -> Project
  sourceAssetId -> Asset
  status: "queued" | "running" | "succeeded" | "failed"
  errorCode, errorMessage
  resultVersionId -> ProjectVersion, nullable
  createdAt, startedAt, finishedAt
```

`Project.updatedAt` changes when a new version is saved. The dashboard reads projects, not every version. v1 UI loads the latest version only.

`deletedAt` hides a project from the owner. v1 may hard-delete the row and its storage objects instead, as long as another user still cannot see it. Pick one behavior in Phase 1 and use it for both projects and their assets.

### Categories

`startup`, `freelancer`, `local-business`, `agency`.

## Project JSON (`schemaVersion` 1)

```json
{
  "schemaVersion": 1,
  "artboard": {
    "preset": "square",
    "width": 1000,
    "height": 1000,
    "background": "#ffffff"
  },
  "objects": []
}
```

`background` is `#rrggbb` or `null` for transparent. Array order is layer order. The first object is at the back.

Every object has:

```json
{
  "id": "obj_01HXYZ",
  "type": "text",
  "name": "Wordmark",
  "x": 0,
  "y": 0,
  "width": 100,
  "height": 40,
  "scaleX": 1,
  "scaleY": 1,
  "angle": 0,
  "opacity": 1,
  "visible": true,
  "locked": false
}
```

`id` is stable for the life of that object. Duplicate creates a new id.

Type-specific fields:

| Type | Fields |
|---|---|
| `text` | `text`, `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `textAlign`, `fill` |
| `rect`, `ellipse`, `line` | `fill`, `stroke`, `strokeWidth` |
| `icon` | `iconId`, `fill` |
| `image` | `assetId` |
| `path` | `path`, `fill`, `stroke`, `strokeWidth` |

`path` is how reconstruction stores vectorized artwork. Fill and stroke are `#rrggbb` or `null`.

A reconstruction project adds this beside `artboard`, not inside an object:

```json
{
  "reconstruction": {
    "jobId": "job_01HXYZ",
    "sourceAssetId": "asset_01HXYZ",
    "note": "Draft from a PNG or JPG. It is an approximation."
  }
}
```

The original image is also a normal `image` object with `locked: true` and `name: "Original"`.

## Ownership

- Session required on every route except `GET /api/health`, `POST /api/auth/*`, and the public landing page.
- Load the row by id and `ownerId`. If either check fails, respond with `404` and the same body. Do not use `403` for a row owned by someone else.
- Templates: any signed-in user may list and copy published templates. Only a system task creates them in v1. There is no public template-edit API.
- System assets (`ownerId` null) may be read by any signed-in user. Upload assets may be read only by the owner.

## Errors

```json
{ "error": { "code": "upload_too_large", "message": "Files must be 8 MB or smaller." } }
```

| HTTP | When |
|---|---|
| 400 | Malformed JSON |
| 401 | Missing session |
| 404 | Not found, or not owned |
| 413 | File too large |
| 422 | Validation failed |
| 429 | Too many reconstruction jobs |

## Upload limits

These apply to reconstruction uploads and to images placed on the canvas:

| Rule | Value |
|---|---|
| Reconstruction types | `image/png`, `image/jpeg` |
| Canvas image types | `image/png`, `image/jpeg`, `image/svg+xml` |
| Max file size | 8 MB |
| Min edge | 64 px |
| Max edge | 4096 px |
| Reconstruction concurrency | 1 running or queued job per user |

SVG uploads are for placing an image on the canvas. They are not a reconstruction input. Reject SVG-as-reconstruction with `422` and code `unsupported_type`.

## Endpoints

### Health

`GET /api/health`

Response: `{ "ok": true, "database": "up" }`. Returns 503 when the database is unreachable.

### Projects

`GET /api/projects?query=`

Owner's non-deleted projects, newest update first. `query` filters name.

`POST /api/projects`

```json
{ "name": "Untitled logo", "templateId": null }
```

Creates a project and version 1. With `templateId`, version 1 is a copy of that template document with new object ids.

`GET /api/projects/:projectId`

Project plus its latest document.

`PATCH /api/projects/:projectId`

```json
{ "name": "North studio" }
```

`DELETE /api/projects/:projectId`

`POST /api/projects/:projectId/duplicate`

New project, version 1 copied from the latest document, new object ids, name suffix " copy".

`PUT /api/projects/:projectId/document`

```json
{ "document": { }, "source": "autosave" }
```

Validates `schemaVersion` is `1`, writes the next `ProjectVersion`, and updates `Project.updatedAt`. The client debounces autosave by about 2 seconds and sends `source: "save"` for an explicit save.

### Templates

`GET /api/templates?category=&query=`

Published templates only.

`POST /api/templates/:templateId/use`

Same result as creating a project with that `templateId`.

### Uploads

`POST /api/uploads`

Multipart file. Creates an `Asset` after type, size, and dimension checks. Response: `{ "asset": { "id", "mimeType", "width", "height", "byteSize" } }`.

File bytes go to object storage. The response does not return a permanent public URL. The editor loads the file through a short-lived signed URL or an authenticated read route, chosen in Phase 1.

### Reconstruction

`POST /api/reconstruction`

```json
{ "projectId": "proj_01HXYZ", "assetId": "asset_01HXYZ" }
```

Returns `202` and `{ "job": { "id", "status": "queued" } }`. Returns `429` when this user already has a queued or running job.

`GET /api/reconstruction/:jobId`

```json
{
  "job": {
    "id": "job_01HXYZ",
    "status": "succeeded",
    "error": null,
    "resultVersionId": "ver_01HXYZ"
  }
}
```

On success, that version's document contains the locked original image and the candidate objects. The client then loads the project as usual.

### Auth

Auth.js routes under `/api/auth/*`. v1 uses the credentials provider (email and password). Adding a later OAuth provider must keep `User.email` as the unique identity and must not change project ownership.

## Validation

Use Zod for every JSON body and for the project document on write. Reject unknown `schemaVersion` values with `422` and code `unsupported_schema`.
