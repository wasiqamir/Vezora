# Artboards and export

**Status:** Locked for Phase 1.

Coordinates are in CSS pixels. The top-left of the artboard is `(0, 0)`. Object positions are stored in this space, before zoom. Zoom changes only the on-screen view.

## Presets

| Id | Name | Width | Height | Default use |
|---|---|---:|---:|---|
| `square` | Square | 1000 | 1000 | Default for a new project |
| `icon` | Icon | 512 | 512 | App icon or avatar source |
| `horizontal` | Horizontal | 1600 | 800 | Icon plus wordmark |
| `vertical` | Vertical | 800 | 1400 | Stacked mark and name |

New blank projects use `square` and a white background (`#ffffff`).

## Custom size

- Minimum edge: 256 px
- Maximum edge: 2048 px
- Both edges are integers
- Changing the artboard size does not scale existing objects in v1. The user moves them. Say that in the size control.

## Background

- Solid color, stored as `#rrggbb`
- Or transparent, stored as `null`
- Default: `#ffffff`
- The editor draws a checkerboard behind a transparent artboard so the user can see empty areas

## SVG export

- One file, `{project-slug}.svg`
- `viewBox` equals the artboard: `0 0 {width} {height}`
- `width` and `height` attributes match the artboard in pixels
- Object order in the file matches layer order, bottom to top
- Hidden objects are omitted. Locked objects are included
- Text stays as `<text>` using the font family name. Do not convert text to paths in v1
- Images are embedded in the SVG so the file opens without the app
- Transparent artboard omits the background rectangle. Solid artboard writes one full-size rectangle at the back
- The download control waits until every font and image on the artboard has loaded

## PNG export

| Scale | File | Pixel size |
|---|---|---|
| 1× | `{project-slug}.png` | Artboard width × height |
| 2× | `{project-slug}@2x.png` | Twice the artboard on each edge |

- Background choices: use the artboard color, or force transparent
- Forcing transparent ignores a solid artboard color for that download only. It does not change the saved project
- Transparent PNG is 32-bit with an alpha channel
- Crop to the artboard. Objects outside the artboard are clipped
- Wait for fonts and images, same rule as SVG

## Preview

The export dialog previews the chosen format on three backgrounds: white, `#111111`, and a checkerboard. The preview is not the downloaded file. The download is rendered from the canvas at the selected scale.

## File name

`project-slug` is the project name lowercased, with spaces turned into hyphens, and any character outside `a-z`, `0-9`, and `-` removed. If that leaves an empty string, use `logo`.

## Not in v1

Favicon packs, social-crop sizes, PDF, EPS, and any scale other than 1× and 2×.
