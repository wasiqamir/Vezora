import { createWorker, PSM, type Worker } from "tesseract.js";
import type { TextHit } from "@/features/reconstruction/ocr";

export type OcrBand = { x: number; y: number; width: number; height: number };

/**
 * Browser OCR for Edit elements. Server skips Tesseract (crashes on Vercel).
 * Uses white + inverted plates and optional path-band crops so light type on dark
 * boards (BLOOM / ATELIER) becomes live text instead of image slices.
 */
export async function recognizeLogoText(
  source: Blob,
  options: { bands?: OcrBand[] } = {},
): Promise<TextHit[]> {
  const bitmap = await createImageBitmap(source);
  try {
    // Browser defaults load worker + traineddata from jsDelivr (reliable under Next.js).
    const worker = await createWorker("eng");
    try {
      const lines: TextHit[] = [];
      const plates = await buildPlates(bitmap);
      for (const plate of plates) {
        await collectFromImage(worker, plate.canvas, plate.scale, lines, PSM.AUTO);
        await collectFromImage(worker, plate.canvas, plate.scale, lines, PSM.SPARSE_TEXT);
      }
      // Crop traced letter bands — more reliable for logo lockups than full-frame OCR alone.
      for (const band of options.bands ?? []) {
        if (band.width < 8 || band.height < 6) continue;
        const crop = await cropBand(bitmap, band);
        if (!crop) continue;
        try {
          const cropPlates = await buildPlates(crop.bitmap);
          for (const plate of cropPlates) {
            const before = lines.length;
            await collectFromImage(worker, plate.canvas, plate.scale, lines, PSM.SINGLE_LINE);
            for (let index = before; index < lines.length; index += 1) {
              const hit = lines[index]!;
              hit.x += crop.originX;
              hit.y += crop.originY;
            }
          }
        } finally {
          crop.bitmap.close();
        }
      }
      return lines;
    } finally {
      await worker.terminate();
    }
  } finally {
    bitmap.close();
  }
}

async function collectFromImage(
  worker: Worker,
  canvas: HTMLCanvasElement,
  scale: number,
  lines: TextHit[],
  mode: PSM,
) {
  await worker.setParameters({ tessedit_pageseg_mode: mode, user_defined_dpi: "144" });
  const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        pushHit(lines, line.text, line.bbox, line.confidence, scale);
        for (const word of line.words ?? []) {
          pushHit(lines, word.text, word.bbox, word.confidence, scale);
        }
      }
    }
  }
}

function pushHit(
  lines: TextHit[],
  raw: string,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  confidence: number,
  scale: number,
) {
  const text = raw.replace(/[^A-Za-z0-9'. -]/g, " ").replace(/\s+/g, " ").trim();
  if (!/[A-Za-z]{2,}/.test(text) || confidence < 20) return;
  if (text.includes(" ") && text.split(" ").every((part) => lines.some((hit) => hit.text === part))) {
    return;
  }
  if (lines.some((hit) => hit.text.toLowerCase() === text.toLowerCase())) return;
  const width = Math.max(1, (bbox.x1 - bbox.x0) / scale);
  const height = Math.max(1, (bbox.y1 - bbox.y0) / scale);
  if (width < 4 || height < 4) return;
  lines.push({
    text: text.slice(0, 80),
    x: bbox.x0 / scale,
    y: bbox.y0 / scale,
    width,
    height,
    confidence,
  });
}

async function buildPlates(bitmap: ImageBitmap) {
  const scale = Math.max(1, Math.min(3, Math.ceil(1000 / Math.max(bitmap.width, bitmap.height))));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const context = base.getContext("2d");
  if (!context) return [];
  context.imageSmoothingEnabled = true;
  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  let lumaSum = 0;
  let opaque = 0;
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = (pixels.data[offset + 3] ?? 0) / 255;
    if (alpha < 0.08) continue;
    const red = (pixels.data[offset] ?? 0) * alpha + 255 * (1 - alpha);
    const green = (pixels.data[offset + 1] ?? 0) * alpha + 255 * (1 - alpha);
    const blue = (pixels.data[offset + 2] ?? 0) * alpha + 255 * (1 - alpha);
    lumaSum += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    opaque += 1;
  }
  const mean = opaque > 0 ? lumaSum / opaque : 255;

  const onWhite = document.createElement("canvas");
  onWhite.width = width;
  onWhite.height = height;
  const whiteContext = onWhite.getContext("2d");
  if (!whiteContext) return [];
  whiteContext.fillStyle = "#ffffff";
  whiteContext.fillRect(0, 0, width, height);
  whiteContext.drawImage(base, 0, 0);

  const plates = [{ canvas: onWhite, scale }];
  // Dark boards with light type: invert so Tesseract sees black ink on white.
  if (mean < 140) {
    const inverted = document.createElement("canvas");
    inverted.width = width;
    inverted.height = height;
    const invertedContext = inverted.getContext("2d");
    if (invertedContext) {
      invertedContext.drawImage(base, 0, 0);
      const image = invertedContext.getImageData(0, 0, width, height);
      for (let index = 0; index < width * height; index += 1) {
        const offset = index * 4;
        image.data[offset] = 255 - (image.data[offset] ?? 0);
        image.data[offset + 1] = 255 - (image.data[offset + 1] ?? 0);
        image.data[offset + 2] = 255 - (image.data[offset + 2] ?? 0);
        image.data[offset + 3] = 255;
      }
      invertedContext.putImageData(image, 0, 0);
      plates.push({ canvas: inverted, scale });
    }
  }
  return plates;
}

async function cropBand(bitmap: ImageBitmap, band: OcrBand) {
  const pad = Math.max(4, Math.round(band.height * 0.25));
  const x = Math.max(0, Math.floor(band.x - pad));
  const y = Math.max(0, Math.floor(band.y - pad));
  const width = Math.min(bitmap.width - x, Math.ceil(band.width + pad * 2));
  const height = Math.min(bitmap.height - y, Math.ceil(band.height + pad * 2));
  if (width < 8 || height < 6) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  return {
    originX: x,
    originY: y,
    bitmap: await createImageBitmap(canvas),
  };
}
