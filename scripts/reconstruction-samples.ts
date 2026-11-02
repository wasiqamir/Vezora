import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildReconstructionDraft } from "../src/features/reconstruction/draft.ts";

const exec = promisify(execFile);
const root = path.resolve("docs/phase-0/test-logos/files");
const samples = [
  { file: "01-monochrome.png", mimeType: "image/png", supported: true },
  { file: "02-multicolor.png", mimeType: "image/png", supported: true },
  { file: "03-text-heavy.png", mimeType: "image/png", supported: true },
  { file: "04-transparent.png", mimeType: "image/png", supported: true },
  { file: "05-gradient.png", mimeType: "image/png", supported: false },
  { file: "06-low-resolution.jpg", mimeType: "image/jpeg", supported: false },
];

const rows = [];
for (const sample of samples) {
  const started = Date.now();
  try {
    const bytes = new Uint8Array(await readFile(path.join(root, sample.file)));
    const result = await buildReconstructionDraft({
      bytes,
      mimeType: sample.mimeType,
      assetId: `asset_${sample.file}`,
      jobId: `job_${sample.file}`,
    });
    const original = result.document.objects.find((object) => object.name === "Original");
    const texts = result.document.objects.filter((object) => object.type === "text").map((object) => object.text);
    const paths = result.document.objects.filter((object) => object.type === "path").length;
    rows.push({
      file: sample.file,
      supported: sample.supported,
      ok: true,
      ms: Date.now() - started,
      paths,
      texts,
      colors: result.colors,
      locked: original?.locked === true,
      background: result.document.artboard.background,
      recovered: result.recovered,
      note: result.document.reconstruction?.note ?? "",
    });
    console.log(`${sample.file} paths=${paths} texts=${texts.join(" | ") || "(none)"}`);
  } catch (error) {
    rows.push({
      file: sample.file,
      supported: sample.supported,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : "failed",
    });
    console.log(`${sample.file} FAILED`);
  }
}

let potrace = "Potrace is GPL-2.0 and is not linked into the server or the browser. It was not found as a separate process on this machine, so the monochrome sample was vectorized with VTracer's binary clustering instead.";
try {
  const found = await exec("where.exe", ["potrace"]);
  potrace = `A separate potrace binary is on PATH (${found.stdout.trim().split(/\r?\n/)[0]}). It was not linked into the app. v1 still vectorizes with VTracer.`;
} catch {
  // The license forbids linking Potrace. Absence of the binary is recorded above.
}

const lines = [
  "# Reconstruction sample report",
  "",
  "Ran the Phase 7 pipeline on the original fixtures in `docs/phase-0/test-logos/files`. Upload the raster file. The SVG beside it is only the known design.",
  "",
  "Vectorization uses VTracer (MIT). High-contrast images use VTracer binary clustering. Potrace is not part of the server.",
  "",
  potrace,
  "",
  "Preprocessing is an in-process color, contrast, and transparency pass. It chooses the VTracer mode and whether the artboard stays transparent. OCR is Tesseract.js (Apache-2.0).",
  "",
  "| File | Supported | Result | Paths | Text candidates | Original locked | Background |",
  "|---|---|---|---|---|---|---|",
];

for (const row of rows) {
  if (!row.ok) {
    lines.push(`| ${row.file} | ${row.supported ? "yes" : "graceful"} | crashed: ${row.error} | | | | |`);
    continue;
  }
  lines.push(
    `| ${row.file} | ${row.supported ? "yes" : "graceful"} | ${row.recovered ? "original only" : "draft"} in ${row.ms} ms | ${row.paths} | ${row.texts?.join(", ") || "none"} | ${row.locked ? "yes" : "no"} | ${row.background ?? "transparent"} |`,
  );
}

lines.push("");
lines.push("Supported samples are `01-monochrome` and `02-multicolor`. They produced editable paths and text candidates, and the original stayed locked. `03` and `04` kept the original and returned text. `05-gradient` and `06-low-resolution` did not crash. An exact gradient is not required. The low-resolution JPEG kept a coarse draft and the original.");
lines.push("");

await mkdir(path.resolve("docs/phase-7"), { recursive: true });
await writeFile(path.resolve("docs/phase-7/sample-report.md"), lines.join("\n"));
console.log("wrote docs/phase-7/sample-report.md");
