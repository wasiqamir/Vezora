import { createWorker, PSM } from "tesseract.js";
import { compositeOnWhite, encodePng, ocrPlates, type Raster } from "@/features/reconstruction/preprocess";

export type TextHit = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
};

export async function readText(
  raster: Raster,
  options: { fast?: boolean } = {},
): Promise<TextHit[]> {
  const worker = await createWorker("eng");
  try {
    const lines: TextHit[] = [];
    const passes = options.fast
      ? [{ plate: compositeOnWhite(raster), mode: PSM.AUTO }]
      : [
          { plate: compositeOnWhite(raster), mode: PSM.AUTO },
          ...ocrPlates(raster).map((plate) => ({ plate, mode: PSM.SPARSE_TEXT })),
        ];
    for (const pass of passes) {
      await worker.setParameters({ tessedit_pageseg_mode: pass.mode, user_defined_dpi: "96" });
      const result = await worker.recognize(Buffer.from(encodePng(pass.plate)), {}, { text: true, blocks: true });
      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            const text = line.text.replace(/[^A-Za-z0-9'. -]/g, " ").replace(/\s+/g, " ").trim();
            if (!/[A-Za-z]{3,}/.test(text) || line.confidence < 25) continue;
            if (lines.some((hit) => hit.text === text)) continue;
            lines.push({
              text: text.slice(0, 80),
              x: line.bbox.x0,
              y: line.bbox.y0,
              width: Math.max(1, line.bbox.x1 - line.bbox.x0),
              height: Math.max(1, line.bbox.y1 - line.bbox.y0),
              confidence: line.confidence,
            });
            if (lines.length >= 8) return lines;
          }
        }
      }
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}
