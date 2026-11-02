# MVP scope

**Status:** Locked for Phase 1.

The first release is a single-user logo editor. A person can design a logo, save the editable project, reopen it, export SVG and PNG, start from a template, or turn a suitable PNG/JPG into an editable draft and correct it by hand.

Raster reconstruction is best-effort. PNG and JPG files store pixels, not layers or font files. The product must say that in the upload flow.

## Primary users

| User | What they need from v1 |
|---|---|
| Startup founder | A wordmark or simple mark, then an SVG and a PNG the same day |
| Freelancer | A template to customize for a client, then a file they can reopen |
| Small business | Name, icon, and colors, exported for a site or social profile |
| Branding team | A draft another person can reopen, plus SVG for later refinement |

People who need live collaboration, CMYK print files, or exact recovery of any uploaded logo are not the v1 audience.

## In the first release

### Accounts and access

- Sign-up and sign-in with email and password (Auth.js credentials).
- One owner per project. No teams, sharing, or roles.
- Every project, asset, and reconstruction job is readable and writable only by its owner.
- System templates and the built-in icon set are readable by any signed-in user.

### Projects

- Create a blank project, rename it, duplicate it, and delete it.
- Autosave the canvas, with a visible status: Saving, Saved, or Save failed.
- Reopen a project and restore artboard, objects, order, lock, visibility, and styles.
- Store a versioned project JSON document. Do not treat an exported PNG as the saved project.

### Editor

- Artboard with the presets in [artboards-and-export.md](artboards-and-export.md), plus a custom size inside those limits.
- Solid background color, or transparent.
- Tools: select, text, rectangle, ellipse, line, built-in icon, and user image (PNG, JPG, SVG).
- Select, move, resize, rotate, duplicate, and delete.
- Properties: fill, stroke, stroke width, opacity, position, size, rotation.
- Text properties: font from the approved list, size, weight, letter spacing, line height, alignment.
- Layers: reorder, hide, lock, select, rename.
- Undo and redo.
- Align to the artboard: left, center, right, top, middle, bottom. Distribute when three or more objects are selected.
- Zoom and fit-to-artboard.
- Keyboard shortcuts for undo, redo, delete, duplicate, and nudge.

### Templates and assets

- Four categories: Startup, Freelancer, Local business, Agency.
- Eight original templates, two per category. Opening one creates a new project copy. The template itself does not change.
- A small original icon set used inside logos.
- The font list in [licensing.md](licensing.md). No user-uploaded fonts in v1.

### Export

- SVG and PNG, as specified in [artboards-and-export.md](artboards-and-export.md).
- Preview on light, dark, and checkerboard backgrounds.
- Wait until the fonts and images used on the artboard have loaded before exporting.

### Reconstruction

- Upload PNG or JPG, with the limits in [database-and-api.md](database-and-api.md).
- Keep the original image as a locked reference layer.
- Run the job asynchronously. The client creates a job and polls status.
- Vectorize flat-color artwork (VTracer). Use Potrace only as an optional separate monochrome tool, not linked into the app server. See [licensing.md](licensing.md).
- Suggest text with OCR. The user can edit the words and pick an approved font.
- Show the original, an overlay, and the draft.
- Save the corrected draft as a normal project in the same JSON format.
- Unsupported images must fail gently: keep the reference image, show an error or a low-confidence warning, and do not crash.

### Screens

Landing, sign-in, dashboard, template gallery, editor, export dialog, reconstruction flow. Layouts are in [wireframes.md](wireframes.md).

The editor is supported at a viewport of at least 1100px wide. Narrower viewports can use landing, sign-in, and dashboard. The editor shows a short message asking for a wider screen.

## Out of the first release

Do not build these during Phases 1–10:

- Billing, plans, or usage quotas beyond the upload and job limits already listed
- Team workspaces, sharing, or comments
- Brand kits and saved palettes beyond the colors on a single project
- A version-history browser (the database may store versions; v1 UI uses the latest)
- PDF, EPS, or CMYK export
- Extra PNG sizes beyond 1× and 2×
- User-uploaded fonts
- Background removal and other AI image tools
- Collaboration, cursors, or multiplayer editing
- Mobile layout of the canvas editor

## Template starter set

Phase 6 designs these. Names and intent stay fixed so the gallery has a target.

| Category | Template | Intent |
|---|---|---|
| Startup | Signal | Circle mark plus a short wordmark |
| Startup | Northstar | Horizontal name with a small star mark |
| Freelancer | Studio Mark | Monogram and a personal name |
| Freelancer | Monogram | Large initials, tiny role line |
| Local business | Storefront | Stacked name and town line |
| Local business | Badge | Circular badge with a business name |
| Agency | Wordmark Grid | Wide wordmark, no icon |
| Agency | Split Mark | Icon on the left, name and service on the right |

## Acceptance criteria

The first release is done when all of these pass:

1. A new user can sign up, sign in, and sign out.
2. A signed-in user can create a blank project and a project from each template category.
3. The user can add text, a rectangle, an ellipse, a line, an icon, and an image, then change fill, stroke, opacity, font, and size.
4. The user can move, resize, rotate, align, duplicate, delete, reorder, hide, and lock objects.
5. Undo and redo return the canvas to the previous state, including delete and reorder.
6. After autosave, closing the browser and reopening the project restores the same objects, styles, order, and artboard.
7. User A receives 404 or 403 for User B's project, asset, and job ids, and cannot tell one missing id from another user's id.
8. SVG and PNG exports match the artboard bounds. A transparent export has no background pixels. Fonts used on the canvas are loaded before export.
9. Upload rejects a non-image, a file over the size limit, and an image outside the dimension limits, with a visible error.
10. `01-monochrome` and `02-multicolor` in the test set produce editable objects and keep the original as a locked layer. `05-gradient` and `06-low-resolution` do not crash and still show the original.
11. A corrected reconstruction saves and reopens as a normal project.
12. Dashboard empty, editor loading, save failure, and upload failure each have a visible state.
13. The reconstruction screen states that recovery from PNG/JPG is an approximation.

## How to change this scope

Phase 1 may adjust field names, indexes, and component structure. It may not add a feature from the out-of-scope list, a new export format, or a new editor tool. Write the change in this file before implementing it.
