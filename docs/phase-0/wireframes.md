# Wireframes

Desktop layouts for the first release. These describe structure and primary actions, not final visual design. The editor layout assumes a viewport at least 1100px wide.

## Flow

```text
Landing
  └─ Sign in / Sign up
       └─ Dashboard
            ├─ New blank project ───────────────┐
            ├─ Template gallery → Use template ─┤
            └─ Open existing project ───────────┴─ Editor
                                                    ├─ Export dialog → download SVG / PNG
                                                    └─ Reconstruct from PNG/JPG → Editor draft
```

A reconstruction always ends as a normal project. After it is saved, the editor is the same screen as any other project.

## Landing `/`

```text
+--------------------------------------------------------------+
| Logo tool                                  Sign in   Sign up |
+--------------------------------------------------------------+
|                                                              |
|  Design a logo you can reopen and edit.                     |
|  Export SVG and PNG. Upload a simple image to start a draft.|
|                                                              |
|  [ Start a logo ]                                            |
|                                                              |
|  Create from text and shapes                                 |
|  Save the editable project, not only a picture               |
|  PNG/JPG import is an approximation you can correct          |
+--------------------------------------------------------------+
```

Primary action: Start a logo. Signed-out visitors go to sign-up, then a new blank project.

## Sign in `/sign-in`

```text
+----------------------------------+
| Logo tool                        |
|                                  |
| Email                            |
| [                            ]   |
| Password                         |
| [                            ]   |
|                                  |
| [ Sign in ]                      |
|                                  |
| Need an account? Sign up         |
|                                  |
| Invalid email or password.       |
+----------------------------------+
```

Sign-up uses the same fields plus a name. Errors stay on the form. Do not reveal whether the email is already registered on sign-in failure.

## Dashboard `/dashboard`

```text
+--------------------------------------------------------------+
| Logo tool          Projects                    Account menu  |
+--------------------------------------------------------------+
| [ Search projects            ]     [ Templates ] [ New logo ]|
|                                                              |
| +----------------+  +----------------+  +----------------+   |
| | preview        |  | preview        |  | preview        |   |
| | North studio   |  | Pine goods     |  | Harbor legal   |   |
| | Edited 2h ago  |  | Edited yesterday| | Saving...     |   |
| | Rename Dup Del |  |                |  |                |   |
| +----------------+  +----------------+  +----------------+   |
+--------------------------------------------------------------+
```

Empty state, when there are no projects and the search box is empty:

```text
No logos yet.
[ Start blank ]    [ Browse templates ]
```

Search with no matches: "No projects match that name." plus a clear-search action.

Cards open the editor. Rename, duplicate, and delete are on the card. Delete asks for confirmation.

## Template gallery `/templates`

```text
+--------------------------------------------------------------+
| Logo tool     Templates                    Back to projects  |
+--------------------------------------------------------------+
| [ All ] [ Startup ] [ Freelancer ] [ Local business ] [ Agency ]|
| [ Search templates          ]                                |
|                                                              |
| +----------------+  +----------------+                       |
| | preview        |  | preview        |                       |
| | Signal         |  | Northstar      |                       |
| | Startup        |  | Startup        |                       |
| | [ Use template ]| | [ Use template ]|                      |
| +----------------+  +----------------+                       |
+--------------------------------------------------------------+
```

Use template creates a new project copy and opens the editor. The template name becomes the project name plus "copy" only if the user already has that name. The original template stays unchanged.

## Editor `/editor/[projectId]`

```text
+--------------------------------------------------------------------------+
| < Projects   [ Project name        ]     Saving...   Undo Redo  Export  |
+----------+-----------------------------------------------+---------------+
| Select   |                                               | Properties    |
| Text     |                                               | Name          |
| Rect     |              Artboard                         | X  Y  W  H    |
| Ellipse  |                                               | Rotation      |
| Line     |                                               | Opacity       |
| Icon     |                                               | Fill  Stroke  |
| Image    |                                               | ------------- |
|          |                                               | Layers        |
|          |                                               |  ^ v  eye lock|
|          |                                               |  Wordmark     |
|          |                                               |  Mark         |
+----------+-----------------------------------------------+---------------+
|  -  100%  +    Fit     Artboard: Square 1000×1000        Background     |
+--------------------------------------------------------------------------+
```

Behavior:

- The canvas does not remount when a property field changes.
- Clicking an object selects it in the layers list. Clicking a layer selects it on the canvas.
- Locked objects stay visible but do not move. Hidden objects stay in the list.
- The reference image from a reconstruction is a locked layer named "Original" until the user unlocks it.
- Icon opens a picker of the built-in set. Image opens a file picker for PNG, JPG, or SVG.
- Below 1100px width, replace the workspace with: "The editor needs a wider window." Link back to projects.

Loading: a quiet placeholder in the artboard area until fonts and the project JSON are ready. Do not flash an empty artboard and then jump.

Save failed: keep the editor open, show "Save failed" with Retry. Do not discard local edits.

## Export dialog

```text
+------------------------------------------+
| Export                              Close|
|                                          |
| Format        ( ) SVG   ( ) PNG          |
| PNG scale     ( ) 1×    ( ) 2×           |
| Background    ( ) Artboard color         |
|               ( ) Transparent            |
|                                          |
| Preview                                  |
| [ Light ] [ Dark ] [ Checkerboard ]      |
| +--------------------------------------+ |
| |            logo preview              | |
| +--------------------------------------+ |
|                                          |
| [ Download ]                             |
+------------------------------------------+
```

Download stays disabled while fonts or images are still loading, with the label "Waiting for fonts…". SVG ignores the PNG scale control. Transparent PNG uses an alpha channel.

## Reconstruction

Entry from the editor: "Start from an image". Also available on an empty project.

```text
+------------------------------------------------------------------+
| Start from an image                                         Close|
|                                                                  |
| PNG and JPG only. Up to 8 MB. 64 to 4096 px on each side.        |
| This builds an editable draft. It will not match every original. |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Drop a PNG or JPG, or browse                                 | |
| +--------------------------------------------------------------+ |
|                                                                  |
| North.png · 1000×1000 · 240 KB                                   |
| [ Create draft ]                                                 |
+------------------------------------------------------------------+
```

While the job runs:

```text
Reading the image…
[ Cancel ]
```

Result:

```text
+------------------------------------------------------------------+
| Compare                                                  Save    |
| [ Original ] [ Overlay ] [ Draft ]                               |
|                                                                  |
| +---------------------------+  +------------------------------+  |
| |                           |  | Detected                     |  |
| |   selected view           |  | Mark          path           |  |
| |                           |  | NORTH         text   Edit    |  |
| +---------------------------+  +------------------------------+  |
|                                                                  |
| Colors found: #111111                                            |
| Some parts may be missing. Edit the draft after you save.       |
+------------------------------------------------------------------+
```

Edit on a text row replaces the string and lets the user pick an approved font. Save writes a normal project and closes this view into the editor. The original upload remains the locked "Original" layer.

Failure:

```text
Could not build a draft from this image.
The original is still on the canvas as a locked layer.
[ Back to editor ]
```

## States to design in Phase 1

| Screen | Empty | Loading | Error |
|---|---|---|---|
| Dashboard | No logos yet | Project cards skeleton | Could not load projects, with Retry |
| Templates | No templates in this category | Card skeleton | Could not load templates, with Retry |
| Editor | Blank artboard is valid, not an error | Hold paint until the document is ready | Project missing, or save failed |
| Export | — | Waiting for fonts | Export failed, stay in the dialog |
| Reconstruction | Dropzone before a file is chosen | Job status line | Validation error, or job failed |
