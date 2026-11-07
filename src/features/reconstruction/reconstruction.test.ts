import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import { migrateDocument, type ProjectDocument } from "../projects/document.ts";
import { templatePreviewSvg } from "../templates/preview.ts";
import {
  asExactEditablePieces,
  attachLiveText,
  mergePaths,
  preferEditableElements,
  preferEditableText,
  preferVectorOutlines,
  textLikeBands,
  useEditableText,
  useVectorOutlines,
} from "./correct.ts";
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
  it("turns a flat PNG into a locked original under editable paths and text", async () => {
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
    assert.match(document.reconstruction?.note ?? "", /exact upload/i);
    assert.equal(original?.visible, false);
    assert.equal(document.objects[0]?.name, "Original");
    assert.ok(word);
    assert.equal(result.recovered, false);
  });

  it("keeps a transparent sample transparent with a hidden locked original under vectors", async () => {
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
    const original = result.document.objects.find((object) => object.name === "Original");
    assert.equal(original?.locked, true);
    assert.equal(original?.visible, false);
    assert.equal(result.document.objects[0]?.name, "Original");
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

  it("hides letter outlines under editable words", () => {
    const withOverlap: ProjectDocument = {
      ...document,
      objects: [
        object("path", "B", { x: 8, y: 18, width: 12, height: 40, path: "M 8 18 H 20 V 58 H 8 Z", fill: "#111111" }),
        object("text", "NORTH", { x: 8, y: 18, width: 40, height: 44, text: "NORTH", confidence: 86 }),
      ],
    };
    const cleaned = preferEditableText(withOverlap);
    assert.equal(cleaned.objects.find((item) => item.type === "text")?.visible, true);
    assert.equal(cleaned.objects.find((item) => item.type === "path")?.visible, false);
  });

  it("keeps letter outlines so Edit elements matches the upload", () => {
    const withOverlap: ProjectDocument = {
      ...document,
      objects: [
        object("path", "B", { x: 8, y: 18, width: 12, height: 40, path: "M 8 18 H 20 V 58 H 8 Z", fill: "#111111" }),
        object("text", "NORTH", { x: 8, y: 18, width: 40, height: 44, text: "NORTH", confidence: 86 }),
      ],
    };
    const cleaned = preferVectorOutlines(withOverlap);
    assert.equal(cleaned.objects.find((item) => item.type === "text")?.visible, false);
    assert.equal(cleaned.objects.find((item) => item.type === "path")?.visible, true);
  });

  it("turns paths into clipped slices of the exact upload", () => {
    const upload = object("image", "Original", {
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      scaleX: 2,
      scaleY: 2,
      assetId: "asset_bloom",
      locked: true,
    });
    const withPaths: ProjectDocument = {
      ...document,
      objects: [
        upload,
        object("path", "Petal", {
          x: 10,
          y: 10,
          width: 40,
          height: 40,
          path: "M 10 10 H 50 V 50 H 10 Z",
          fill: "#eea9fa",
          fillRule: "evenodd",
        }),
        object("text", "ATELIER", { x: 8, y: 80, width: 80, height: 16, text: "ATELIER" }),
      ],
    };
    const pieces = asExactEditablePieces(withPaths, upload);
    const logo = pieces.objects.find((item) => item.name === "Logo");
    const petal = pieces.objects.find((item) => item.name === "Petal");
    assert.equal(pieces.objects.some((item) => item.name === "Base"), false);
    assert.equal(logo?.type, "image");
    assert.equal(logo?.assetId, "asset_bloom");
    assert.equal(logo?.width, 1000);
    assert.equal(logo?.height, 1000);
    assert.equal(logo?.locked, true);
    assert.match(logo?.clipSubtract ?? "", /^M 10 10 H 50 V 50 H 10 Z/);
    // Padded word band clears letter pixels under live ATELIER text.
    assert.match(logo?.clipSubtract ?? "", /M /);
    assert.equal(logo?.visible, true);
    assert.equal(petal?.type, "image");
    assert.equal(petal?.assetId, "asset_bloom");
    assert.equal(petal?.path, "M 10 10 H 50 V 50 H 10 Z");
    assert.equal(petal?.fillRule, "evenodd");
    assert.equal(petal?.clipSubtract, undefined);
    assert.equal(petal?.x, 10);
    assert.equal(petal?.y, 10);
    assert.equal(petal?.width, 40);
    assert.equal(petal?.height, 40);
    assert.equal(petal?.scaleX, 1);
    assert.equal(petal?.locked, false);
    assert.equal(pieces.objects.some((item) => item.name === "Original"), false);
    // Detected words become live text (font/size/color), not per-letter slices.
    const word = pieces.objects.find((item) => item.type === "text");
    assert.equal(word?.text, "ATELIER");
    assert.equal(word?.visible, true);
    assert.equal(word?.locked, false);
  });

  it("turns letter outlines under a word into one editable text object", () => {
    const upload = object("image", "Original", {
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      scaleX: 1,
      scaleY: 1,
      assetId: "asset_bloom",
      locked: true,
    });
    const withLetters: ProjectDocument = {
      ...document,
      artboard: { ...document.artboard, background: "#111122" },
      objects: [
        upload,
        object("path", "Petal", {
          x: 10,
          y: 10,
          width: 40,
          height: 40,
          path: "M 10 10 H 50 V 50 H 10 Z",
          fill: "#eea9fa",
        }),
        object("path", "B", {
          x: 8,
          y: 80,
          width: 18,
          height: 36,
          path: "M 8 80 H 26 V 116 H 8 Z",
          fill: "#f5f5f5",
        }),
        object("path", "L", {
          x: 28,
          y: 80,
          width: 16,
          height: 36,
          path: "M 28 80 H 44 V 116 H 28 Z",
          fill: "#f5f5f5",
        }),
        object("text", "BLOOM", {
          x: 8,
          y: 78,
          width: 90,
          height: 40,
          text: "BLOOM",
          fill: "#1a1028",
          fontSize: 20,
        }),
      ],
    };
    const pieces = asExactEditablePieces(withLetters, upload);
    const logo = pieces.objects.find((item) => item.name === "Logo");
    const petal = pieces.objects.find((item) => item.name === "Petal");
    const letterSlice = pieces.objects.find((item) => item.name === "B" || item.name === "L");
    const word = pieces.objects.find((item) => item.type === "text");
    assert.equal(petal?.type, "image");
    assert.equal(letterSlice, undefined);
    assert.equal(word?.text, "BLOOM");
    // Live text picks a readable letter fill (near-white ink on the dark board).
    assert.equal(word?.fill, "#f5f5f5");
    assert.equal(word?.fontId, "bodoni-moda");
    // Em size tracks the OCR ink box so live text matches the upload scale.
    assert.equal(word?.fontSize, 53);
    assert.equal(word?.visible, true);
    assert.equal(word?.locked, false);
    // Logo stays visible so the artboard matches Original; holes clear letter ghosts.
    assert.equal(logo?.visible, true);
    assert.match(logo?.clipSubtract ?? "", /M 10 10 H 50 V 50 H 10 Z/);
    // Letter outlines are not punched as shapes — a clean word-band rect clears them.
    assert.doesNotMatch(logo?.clipSubtract ?? "", /M 8 80 H 26 V 116 H 8 Z/);
    assert.doesNotMatch(logo?.clipSubtract ?? "", /M 28 80 H 44 V 116 H 28 Z/);
    // Word band is punched out so no pixel letter ghosts sit under the live text.
    assert.match(logo?.clipSubtract ?? "", /M -28 42 H 134 V 154 H -28 Z/);
  });

  it("punches piece holes out of Logo and skips full-board plates", () => {
    const upload = object("image", "Original", {
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      scaleX: 1,
      scaleY: 1,
      assetId: "asset_bloom",
      locked: true,
    });
    const withNest: ProjectDocument = {
      ...document,
      objects: [
        upload,
        object("path", "Mark", {
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          path: "M 0 0 H 1000 V 1000 H 0 Z",
          fill: "#111122",
        }),
        object("path", "Petal", {
          x: 10,
          y: 10,
          width: 40,
          height: 40,
          path: "M 10 10 H 50 V 50 H 10 Z",
          fill: "#eea9fa",
        }),
      ],
    };
    const pieces = asExactEditablePieces(withNest, upload);
    const logo = pieces.objects.find((item) => item.name === "Logo");
    const mark = pieces.objects.find((item) => item.name === "Mark");
    const petal = pieces.objects.find((item) => item.name === "Petal");
    assert.equal(mark, undefined);
    assert.equal(logo?.clipSubtract, "M 10 10 H 50 V 50 H 10 Z");
    assert.equal(petal?.clipSubtract, undefined);
    assert.equal(pieces.objects[0]?.name, "Logo");
  });

  it("keeps live text when no letter outlines exist so every element stays editable", () => {
    const withTextOnly: ProjectDocument = {
      ...document,
      objects: [
        object("path", "Petal", {
          x: 50,
          y: 20,
          width: 20,
          height: 20,
          path: "M 50 20 H 70 V 40 H 50 Z",
          fill: "#eea9fa",
          locked: true,
        }),
        object("text", "ATELIER", {
          x: 8,
          y: 80,
          width: 80,
          height: 16,
          text: "ATELIER",
          confidence: 95,
          locked: true,
        }),
      ],
    };
    const cleaned = preferEditableElements(withTextOnly);
    assert.equal(cleaned.objects.find((item) => item.type === "text")?.visible, true);
    assert.equal(cleaned.objects.find((item) => item.type === "text")?.locked, false);
    assert.equal(cleaned.objects.find((item) => item.type === "path")?.locked, false);
  });

  it("groups small path rows into text-like bands for OCR crops", () => {
    const withLetters: ProjectDocument = {
      ...document,
      objects: [
        object("path", "B", {
          x: 40,
          y: 200,
          width: 30,
          height: 50,
          path: "M 40 200 H 70 V 250 H 40 Z",
          fill: "#fff",
        }),
        object("path", "L", {
          x: 80,
          y: 205,
          width: 28,
          height: 48,
          path: "M 80 205 H 108 V 253 H 80 Z",
          fill: "#fff",
        }),
        object("path", "O", {
          x: 120,
          y: 202,
          width: 32,
          height: 50,
          path: "M 120 202 H 152 V 252 H 120 Z",
          fill: "#fff",
        }),
        object("path", "Mark", {
          x: 400,
          y: 40,
          width: 80,
          height: 80,
          path: "M 400 40 H 480 V 120 H 400 Z",
          fill: "#f0abfc",
        }),
      ],
    };
    const bands = textLikeBands(withLetters);
    assert.equal(bands.length, 1);
    assert.ok(bands[0]!.width > 100);
    assert.ok(bands[0]!.y >= 200 && bands[0]!.y <= 210);
  });

  it("attaches OCR hits as live text scaled to the artboard", () => {
    const base: ProjectDocument = {
      ...document,
      artboard: { ...document.artboard, width: 500, height: 500, background: "#111122" },
      objects: [
        object("path", "Mark", {
          x: 10,
          y: 10,
          width: 40,
          height: 40,
          path: "M 10 10 H 50 V 50 H 10 Z",
          fill: "#eea9fa",
        }),
      ],
    };
    const withText = attachLiveText(
      base,
      [{ text: "VOLT", x: 100, y: 200, width: 200, height: 80, confidence: 90 }],
      1000,
      1000,
    );
    const word = withText.objects.find((item) => item.type === "text");
    assert.equal(word?.text, "VOLT");
    assert.equal(word?.x, 50);
    assert.equal(word?.y, 100);
    assert.equal(word?.width, 100);
    assert.equal(word?.height, 40);
    const pieces = asExactEditablePieces(
      preferEditableElements(withText),
      object("image", "Original", {
        x: 0,
        y: 0,
        width: 500,
        height: 500,
        assetId: "asset_volt",
      }),
    );
    assert.equal(pieces.objects.find((item) => item.type === "text")?.text, "VOLT");
    assert.equal(pieces.objects.find((item) => item.type === "text")?.fontSize !== undefined, true);
  });

  it("places each OCR word on its letter-row band so Style can edit the full word", () => {
    const base: ProjectDocument = {
      ...document,
      artboard: { ...document.artboard, width: 1000, height: 1000, background: "#1A1028" },
      objects: [
        object("path", "B", {
          x: 250,
          y: 520,
          width: 40,
          height: 70,
          path: "M 250 520 H 290 V 590 H 250 Z",
          fill: "#FDF4FF",
        }),
        object("path", "L", {
          x: 300,
          y: 520,
          width: 40,
          height: 70,
          path: "M 300 520 H 340 V 590 H 300 Z",
          fill: "#FDF4FF",
        }),
        object("path", "O", {
          x: 350,
          y: 520,
          width: 40,
          height: 70,
          path: "M 350 520 H 390 V 590 H 350 Z",
          fill: "#FDF4FF",
        }),
      ],
    };
    const band = { x: 250, y: 520, width: 140, height: 70 };
    const withText = attachLiveText(
      base,
      [{ text: "BLOOM", x: 260, y: 530, width: 100, height: 50, confidence: 92 }],
      1000,
      1000,
      [band],
    );
    const word = withText.objects.find((item) => item.type === "text");
    assert.equal(word?.text, "BLOOM");
    assert.equal(word?.x, 250);
    assert.equal(word?.y, 520);
    assert.equal(word?.width, 140);
    assert.equal(word?.height, 70);
    const pieces = asExactEditablePieces(
      preferEditableElements(withText),
      object("image", "Original", {
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        assetId: "asset_bloom",
      }),
    );
    assert.equal(pieces.objects.find((item) => item.type === "text")?.text, "BLOOM");
    assert.equal(
      pieces.objects.some((item) => item.type === "image" && item.name !== "Logo"),
      false,
    );
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
    const original = merged.document.objects.find((item) => item.name === "Original");
    assert.equal(original?.locked, true);
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
