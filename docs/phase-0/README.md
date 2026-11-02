# Phase 0 — Discovery and scope

This folder is the first-release scope for the Logo Creation Tool. It is the input to Phase 1 (project foundation).

**Status:** Locked for the foundation phase. Do not add features while scaffolding the app, database, or editor. A scope change means editing the decision in `mvp-scope.md` first, then building it.

## Deliverables

| Document | What it decides |
|---|---|
| [mvp-scope.md](mvp-scope.md) | Users, in-scope features, out-of-scope features, acceptance criteria |
| [wireframes.md](wireframes.md) | Dashboard, templates, editor, export, and reconstruction layouts |
| [artboards-and-export.md](artboards-and-export.md) | Artboard presets and SVG/PNG export rules |
| [licensing.md](licensing.md) | Fonts, icons, templates, and reconstruction libraries |
| [database-and-api.md](database-and-api.md) | Entities, project JSON, and HTTP API |
| [test-logos/README.md](test-logos/README.md) | Sample logos and what reconstruction must do with each |
| [preview/index.html](preview/index.html) | Clickable wireframe. This is not the Next.js app |

## Preview

From this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\preview\serve.ps1
```

Then open http://127.0.0.1:4173/preview/

The page is a local wireframe of the screens, the sample logos, and a small artboard you can rearrange and download. It does not save an account or a project.

## Done when

The first release scope is written here and stays unchanged during Phase 1. These files are that scope.
