import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import { migrateDocument, type ProjectDocument } from "../projects/document.ts";
import { templatePreviewSvg } from "../templates/preview.ts";
import { mergePaths, useEditableText, useVectorOutlines } from "./correct.ts";
import { buildReconstructionDraft } from "./draft.ts";
import { pathsFromSvg } from "./paths.ts";
import { studyImage, type Raster } from "./preprocess.ts";

function paint(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = pixel(x, y);
      const offset = (y * width + x) * 4;
      png.data[offset] = red;
      png.data[offset + 1] = green;
      png.data[offset + 2] = blue;
      png.data[offset + 3] = alpha;
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe("reconstruction paths", () => {
  it("keeps the mark and drops a white backdrop", () => {
    const svg = `<svg>
      <path d="M 0 0 H 1000 V 1000 H 0 Z" fill="#ffffff"/>
      <path d="M 40 40 H 120 V 120 H 40 Z" fill="#111111"/>
    </svg>`;
    const paths = pathsFromSvg(svg, 1000, 1000);
    assert.equal(paths.length, 1);
    assert.equal(paths[0]?.fill, "#111111");
  });
});

describe("image study", () => {
  it("treats a two-color mark as high contrast and a noisy field as approximate", () => {
    const flat = raster(32, 32, (x) => (x < 16 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const noisy = raster(32, 32, (x, y) => [(x * 17) % 256, (y * 13) % 256, (x * y) % 256, 255]);
    const flatStudy = studyImage(flat);
    const noisyStudy = studyImage(noisy);
    assert.equal(flatStudy.highContrast, true);
    assert.equal(flatStudy.approximate, false);
    assert.equal(noisyStudy.approximate, true);
  });
});

describe("reconstruction draft", () => {
  it("turns a flat PNG into a locked original, a path, and a text candidate", async () => {
    const bytes = paint(128, 128, (x, y) => {
      const mark = x > 24 && x < 96 && y > 24 && y < 96;
      return mark ? [17, 17, 17, 255] : [255, 255, 255, 255];
    });
    const result = await buildReconstructionDraft({
      bytes,
      mimeType: "image/png",
      assetId: "asset_test",
      jobId: "job_test",
      recognize: async () => [{ text: "NORTH", x: 20, y: 100, width: 80, height: 18, confidence: 86.4 }],
    });
    const document = migrateDocument(result.document);
    const original = document.objects.find((object) => object.name === "Original");
    assert.equal(original?.type, "image");
    assert.equal(original?.locked, true);
    assert.equal(original?.assetId, "asset_test");
    assert.ok(document.objects.some((object) => object.type === "path"));
    const word = document.objects.find((object) => object.type === "text");
    assert.equal(word?.text, "NORTH");
    assert.equal(word?.confidence, 86);
    assert.equal(document.artboard.background, "#ffffff");
    assert.match(document.reconstruction?.note ?? "", /approximation/);
    assert.equal(result.recovered, false);
  });

  it("keeps a transparent sample transparent and still locks the original", async () => {
    const bytes = paint(128, 128, (x, y) => {
      const kite = x > 40 && x < 90 && y > 30 && y < 100;
      return kite ? [20, 90, 180, 255] : [0, 0, 0, 0];
    });
    const result = await buildReconstructionDraft({
      bytes,
      mimeType: "image/png",
      assetId: "asset_clear",
      jobId: "job_clear",
      recognize: async () => [],
    });
    assert.equal(result.document.artboard.background, null);
    assert.equal(result.document.objects[0]?.locked, true);
    assert.equal(result.recovered, false);
  });
});

describe("reconstruction correction", () => {
  const document: ProjectDocument = {
    schemaVersion: 1,
    artboard: { preset: "square", width: 1000, height: 1000, background: "#ffffff" },
    objects: [
      object("path", "Mark", { x: 10, y: 20, width: 30, height: 40, path: "M 10 20 H 40 V 60 H 10 Z", fill: "#111111" }),
      object("path", "Shape 2", { x: 50, y: 20, width: 20, height: 20, path: "M 50 20 H 70 V 40 H 50 Z", fill: "#333333" }),
      object("text", "NORTH", { x: 8, y: 18, width: 40, height: 44, text: "NORTH", confidence: 86 }),
    ],
  };

  it("draws reconstructed paths in the compare preview", () => {
    const svg = templatePreviewSvg(document);
    assert.match(svg, /M 10 20 H 40 V 60 H 10 Z/);
    assert.match(svg, /NORTH/);
  });

  it("keeps letter outlines and hides the guessed word", () => {
    const outlines = useVectorOutlines(document, document.objects[2]?.id ?? "");
    assert.equal(outlines.error, null);
    assert.equal(outlines.document.objects[2]?.visible, false);
    assert.equal(outlines.document.objects[0]?.visible, true);
    const restored = useEditableText(outlines.document, document.objects[2]?.id ?? "");
    assert.equal(restored.document.objects[2]?.visible, true);
    assert.equal(restored.document.objects[0]?.visible, false);
  });

  it("merges two shapes and leaves the original image untouched", () => {
    const withOriginal: ProjectDocument = {
      ...document,
      objects: [
        object("image", "Original", { x: 0, y: 0, width: 1000, height: 1000, locked: true, assetId: "asset_test" }),
        ...document.objects,
      ],
    };
    const merged = mergePaths(withOriginal, [withOriginal.objects[1]?.id ?? "", withOriginal.objects[2]?.id ?? ""]);
    assert.equal(merged.error, null);
    assert.equal(merged.document.objects[0]?.name, "Original");
    assert.equal(merged.document.objects[0]?.locked, true);
    assert.equal(merged.document.objects.filter((item) => item.type === "path").length, 1);
    assert.match(merged.document.objects[1]?.path ?? "", /M 10 20/);
    assert.match(merged.document.objects[1]?.path ?? "", /M 50 20/);
  });
});

function object(
  type: ProjectDocument["objects"][number]["type"],
  name: string,
  extra: Partial<ProjectDocument["objects"][number]>,
): ProjectDocument["objects"][number] {
  return {
    id: `obj_${name.replaceAll(" ", "_")}`,
    type,
    name,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...extra,
  };
}

function raster(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Raster {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = pixel(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = alpha;
    }
  }
  return { width, height, rgba };
}
