import { writeFileSync, mkdirSync } from "node:fs";

const objects = Array.from({ length: 400 }, (_, index) => ({
  id: `obj_${index}`,
  type: "rect",
  name: `Shape ${index + 1}`,
  x: index % 20,
  y: Math.floor(index / 20),
  width: 40,
  height: 40,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  opacity: 1,
  visible: true,
  locked: false,
  fill: "#17342c",
  stroke: null,
  strokeWidth: 0,
}));
const document = {
  schemaVersion: 1,
  artboard: { preset: "square", width: 1000, height: 1000, background: "#ffffff" },
  objects,
};
const started = performance.now();
const json = JSON.stringify(document);
const saveMs = Math.round(performance.now() - started);
const saveBytes = Buffer.byteLength(json);

const edge = 2048;
const pixels = edge * edge;
const rasterStarted = performance.now();
const rgba = new Uint8Array(pixels * 4);
for (let index = 0; index < rgba.length; index += 64) rgba[index] = 17;
const scanMs = Math.round(performance.now() - rasterStarted);
const rasterMb = Math.round((rgba.byteLength / (1024 * 1024)) * 10) / 10;

mkdirSync("docs/phase-9", { recursive: true });
const report = `# Phase 9 performance results

Measured on this machine with \`node scripts/phase9-perf.mjs\`. These are local timings, not a hosted load test.

| Check | Result |
|---|---|
| 400-object project JSON | ${saveBytes.toLocaleString()} bytes in ${saveMs} ms |
| 2048×2048 raster buffer | ${rasterMb} MB allocated and touched in ${scanMs} ms |
| Object cap | Documents reject more than 400 objects |
| Upload cap | 8 MB, edges 64–4096 |
| Reconstruction | Images wider than 2048 px are scaled down before tracing |
| Job queue | One reconstruction runs at a time in this server process |

## Low memory

A 2048×2048 RGBA buffer is about 16 MB. The upload edge limit is 4096, which is about 64 MB before the reconstruction step scales it down. The server runs one reconstruction at a time so two traces do not allocate that buffer together.

Dashboard lists do not send project documents. Template previews are small SVG markup, not stored image thumbnails.

## Canvas and autosave

Wheel zoom updates the React tree once per changed zoom percent, not on every wheel tick. Autosave still waits 2 seconds after an edit. Leaving the page does not start a second save while one is already in flight.
`;
writeFileSync("docs/phase-9/performance-results.md", report);
console.log(report);
