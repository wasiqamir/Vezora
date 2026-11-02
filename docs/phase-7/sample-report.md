# Reconstruction sample report

Ran the Phase 7 pipeline on the original fixtures in `docs/phase-0/test-logos/files`. Upload the raster file. The SVG beside it is only the known design.

Vectorization uses VTracer (MIT). High-contrast images use VTracer binary clustering. Potrace is not part of the server.

Potrace is GPL-2.0 and is not linked into the server or the browser. It was not found as a separate process on this machine, so the monochrome sample was vectorized with VTracer's binary clustering instead.

Preprocessing is an in-process color, contrast, and transparency pass. It chooses the VTracer mode and whether the artboard stays transparent. OCR is Tesseract.js (Apache-2.0).

| File | Supported | Result | Paths | Text candidates | Original locked | Background |
|---|---|---|---|---|---|---|
| 01-monochrome.png | yes | draft in 921 ms | 18 | NORTH, STUDIO | yes | #ffffff |
| 02-multicolor.png | yes | draft in 782 ms | 17 | PINE | yes | #ffffff |
| 03-text-heavy.png | yes | draft in 1088 ms | 28 | HARBOR, LEGAL GROUP, ADVISORY CONTRACTS DISPUTES | yes | #ffffff |
| 04-transparent.png | yes | draft in 757 ms | 5 | KITE | yes | transparent |
| 05-gradient.png | graceful | draft in 910 ms | 10 | AURORA | yes | #ffffff |
| 06-low-resolution.jpg | graceful | draft in 322 ms | 2 | none | yes | #ffffff |

Supported samples are `01-monochrome` and `02-multicolor`. They produced editable paths and text candidates, and the original stayed locked. `03` and `04` kept the original and returned text. `05-gradient` and `06-low-resolution` did not crash. An exact gradient is not required. The low-resolution JPEG kept a coarse draft and the original.
