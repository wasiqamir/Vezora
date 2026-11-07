import { convertPixels, type Options } from "@visioncortex/vtracer";
import type { ProjectDocument, ProjectObject } from "@/features/projects/document";
import { preferEditableElements } from "@/features/reconstruction/correct";
import { readText, type TextHit } from "@/features/reconstruction/ocr";
import { pathsFromSvg } from "@/features/reconstruction/paths";
import {
  decodeRaster,
  encodePng,
  fitRaster,
  studyImage,
  type ImageStudy,
} from "@/features/reconstruction/preprocess";

const DRAFT_NOTE =
  "Your exact upload stays available. Edit elements puts each shape and word on the artboard unlocked.";
const APPROXIMATE_NOTE =
  "Your exact upload stays available. Edit elements puts each shape and word on the artboard unlocked.";

export type DraftResult = {
  document: ProjectDocument;
  colors: string[];
  recovered: boolean;
};

export async function buildReconstructionDraft(input: {
  bytes: Uint8Array;
  mimeType: string;
  assetId: string;
  jobId: string;
  recognize?: (image: Uint8Array) => Promise<TextHit[]>;
  /** Cap OCR wait so guest/serverless drafts still return vector shapes. */
  ocrTimeoutMs?: number;
}): Promise<DraftResult> {
  const decoded = decodeRaster(input.bytes, input.mimeType);
  const fitted = fitRaster(decoded, 2048);
  const study = studyImage(fitted.raster);
  // Grow small bitmaps uniformly so the board stays ≥256 while the image still fills it exactly.
  const layoutScale = Math.max(1, 256 / fitted.raster.width, 256 / fitted.raster.height);
  const artboard = artboardForExactImage(fitted.raster.width * layoutScale, fitted.raster.height * layoutScale);
  const fillScale = artboard.width / decoded.width;
  const original = imageObject(input.assetId, decoded.width, decoded.height, fillScale);
  let paths: ProjectObject[] = [];
  let recovered = false;
  try {
    const svg = convertPixels(fitted.raster.rgba, fitted.raster.width, fitted.raster.height, traceOptions(study));
    paths = pathsFromSvg(svg, fitted.raster.width, fitted.raster.height).map((path, index) =>
      scaleObject(pathObject(path, index), layoutScale),
    );
  } catch {
    recovered = true;
  }
  const background = study.hasTransparency ? null : (study.colors[0] ?? "#07041c");
  const textFill = contrastText(background);
  let texts: ProjectObject[] = [];
  if (!recovered) {
    try {
      const ocr = input.recognize
        ? input.recognize(encodePng(fitted.raster))
        : readText(fitted.raster);
      const hits =
        input.ocrTimeoutMs && input.ocrTimeoutMs > 0
          ? await Promise.race([
              ocr,
              new Promise<TextHit[]>((resolve) => {
                setTimeout(() => resolve([]), input.ocrTimeoutMs);
              }),
            ])
          : await ocr;
      texts = hits.map((hit, index) => scaleObject(textObject(hit, index, textFill), layoutScale));
    } catch {
      texts = [];
    }
  }
  const raw: ProjectDocument = {
    schemaVersion: 1,
    artboard: {
      preset: artboard.preset,
      width: artboard.width,
      height: artboard.height,
      // Match the upload instead of a white board behind it.
      background,
    },
    // Exact upload underneath; editable vectors on top so the icon can be selected.
    objects: [original, ...paths, ...texts],
    reconstruction: {
      jobId: input.jobId,
      sourceAssetId: input.assetId,
      note: study.approximate || recovered ? APPROXIMATE_NOTE : DRAFT_NOTE,
    },
  };
  // Letter outlines when available, otherwise live text — every piece can be edited.
  return {
    recovered,
    colors: colorsFrom(paths, study),
    document: preferEditableElements(raw),
  };
}

function traceOptions(study: ImageStudy): Options {
  if (study.highContrast) {
    return {
      clustering: "bw",
      mode: "spline",
      filterSpeckle: 8,
      binaryThreshold: 180,
    };
  }
  return {
    preset: study.approximate ? "photo" : "poster",
    mode: "spline",
    hierarchical: "cutout",
    maxColors: Math.min(8, Math.max(2, study.colors.length || 4)),
    filterSpeckle: study.approximate ? 12 : 4,
    simplify: 1,
  };
}

function artboardForExactImage(width: number, height: number) {
  const boardWidth = Math.max(256, Math.min(2048, Math.round(width)));
  const boardHeight = Math.max(256, Math.min(2048, Math.round(height)));
  let preset: ProjectDocument["artboard"]["preset"] = "custom";
  if (boardWidth === 1000 && boardHeight === 1000) preset = "square";
  else if (boardWidth === 512 && boardHeight === 512) preset = "icon";
  else if (boardWidth === 1600 && boardHeight === 800) preset = "horizontal";
  else if (boardWidth === 800 && boardHeight === 1400) preset = "vertical";
  return { width: boardWidth, height: boardHeight, preset };
}

function scaleObject(object: ProjectObject, factor: number): ProjectObject {
  if (factor === 1) return object;
  return {
    ...object,
    x: round(object.x * factor),
    y: round(object.y * factor),
    width: round(object.width * factor),
    height: round(object.height * factor),
    ...(object.path ? { path: scalePathD(object.path, factor) } : {}),
    ...(object.fontSize !== undefined ? { fontSize: Math.max(12, round(object.fontSize * factor)) } : {}),
  };
}

/** Scale every numeric coordinate in an SVG path so clips stay aligned after layoutScale. */
function scalePathD(d: string, factor: number) {
  return d.replace(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g, (value) => {
    const next = Number(value) * factor;
    return Number.isFinite(next) ? String(round(next)) : value;
  });
}

function imageObject(assetId: string, width: number, height: number, scale: number): ProjectObject {
  return {
    id: objectId(),
    type: "image",
    name: "Original",
    x: 0,
    y: 0,
    width,
    height,
    scaleX: round(scale),
    scaleY: round(scale),
    angle: 0,
    opacity: 1,
    // Hidden while traced shapes are the editable logo. Side by side / eye can reveal it alone.
    visible: false,
    locked: true,
    assetId,
  };
}

function pathObject(
  path: { d: string; fill: string; fillRule: "evenodd" | "nonzero"; x: number; y: number; width: number; height: number },
  index: number,
): ProjectObject {
  return {
    id: objectId(),
    type: "path",
    name: index === 0 ? "Mark" : `Shape ${index + 1}`,
    x: path.x,
    y: path.y,
    width: path.width,
    height: path.height,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    // The editable icon — only these shapes are shown after save, not a second bitmap copy.
    visible: true,
    locked: false,
    fill: path.fill,
    stroke: null,
    strokeWidth: 0,
    path: path.d,
    fillRule: path.fillRule,
  };
}

function textObject(hit: TextHit, index: number, fill = "#171717"): ProjectObject {
  const size = Math.max(12, Math.min(240, Math.round(hit.height * 0.82)));
  return {
    id: objectId(),
    type: "text",
    name: hit.text.slice(0, 40) || `Text ${index + 1}`,
    text: hit.text,
    x: round(hit.x),
    y: round(hit.y),
    width: Math.max(8, round(hit.width)),
    height: Math.max(8, round(hit.height)),
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill,
    fontFamily: "Outfit",
    fontId: "outfit",
    fontSize: size,
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.16,
    textAlign: "left",
    ...confidenceField(hit.confidence),
  };
}

function contrastText(background: string | null) {
  if (!background || !/^#[0-9a-fA-F]{6}$/.test(background)) return "#171717";
  const value = background.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma < 0.55 ? "#ffffff" : "#171717";
}

function confidenceField(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return {};
  return { confidence: Math.max(0, Math.min(100, Math.round(value))) };
}

function colorsFrom(paths: ProjectObject[], study: ImageStudy) {
  const found = new Set<string>();
  for (const path of paths) {
    if (path.fill) found.add(path.fill);
  }
  if (found.size > 0) return [...found].slice(0, 8);
  return study.colors.slice(0, 8);
}

function objectId() {
  return `obj_${crypto.randomUUID()}`;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function draftColors(document: ProjectDocument) {
  return [
    ...new Set(
      document.objects.flatMap((object) => (object.type === "path" && object.fill ? [object.fill] : [])),
    ),
  ];
}
