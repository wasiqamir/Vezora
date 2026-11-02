import { convertPixels, type Options } from "@visioncortex/vtracer";
import type { ProjectDocument, ProjectObject } from "@/features/projects/document";
import { readText, type TextHit } from "@/features/reconstruction/ocr";
import { pathsFromSvg } from "@/features/reconstruction/paths";
import {
  decodeRaster,
  encodePng,
  fitRaster,
  studyImage,
  type ImageStudy,
} from "@/features/reconstruction/preprocess";

const DRAFT_NOTE = "Draft from a PNG or JPG. It is an approximation.";
const APPROXIMATE_NOTE =
  "Draft from a PNG or JPG. It is an approximation. Flat colors could not be recovered exactly.";

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
}): Promise<DraftResult> {
  const decoded = decodeRaster(input.bytes, input.mimeType);
  const fitted = fitRaster(decoded, 2048);
  const study = studyImage(fitted.raster);
  const artboard = artboardFor(fitted.raster.width, fitted.raster.height);
  const original = imageObject(input.assetId, decoded.width, decoded.height, fitted.scale);
  let paths: ProjectObject[] = [];
  let recovered = false;
  try {
    const svg = convertPixels(fitted.raster.rgba, fitted.raster.width, fitted.raster.height, traceOptions(study));
    paths = pathsFromSvg(svg, fitted.raster.width, fitted.raster.height).map((path, index) =>
      pathObject(path, index),
    );
  } catch {
    recovered = true;
  }
  let texts: ProjectObject[] = [];
  if (!recovered) {
    try {
      const hits = input.recognize ? await input.recognize(encodePng(fitted.raster)) : await readText(fitted.raster);
      texts = hits.map((hit, index) => textObject(hit, index));
    } catch {
      texts = [];
    }
  }
  return {
    recovered,
    colors: colorsFrom(paths, study),
    document: {
      schemaVersion: 1,
      artboard: {
        preset: artboard.preset,
        width: artboard.width,
        height: artboard.height,
        background: study.hasTransparency ? null : "#ffffff",
      },
      objects: [original, ...paths, ...texts],
      reconstruction: {
        jobId: input.jobId,
        sourceAssetId: input.assetId,
        note: study.approximate || recovered ? APPROXIMATE_NOTE : DRAFT_NOTE,
      },
    },
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

function artboardFor(width: number, height: number) {
  const boardWidth = clampEdge(width);
  const boardHeight = clampEdge(height);
  let preset: ProjectDocument["artboard"]["preset"] = "custom";
  if (boardWidth === 1000 && boardHeight === 1000) preset = "square";
  else if (boardWidth === 512 && boardHeight === 512) preset = "icon";
  else if (boardWidth === 1600 && boardHeight === 800) preset = "horizontal";
  else if (boardWidth === 800 && boardHeight === 1400) preset = "vertical";
  return { width: boardWidth, height: boardHeight, preset };
}

function clampEdge(value: number) {
  return Math.max(256, Math.min(2048, Math.round(value)));
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
    visible: true,
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
    visible: true,
    locked: false,
    fill: path.fill,
    stroke: null,
    strokeWidth: 0,
    path: path.d,
    fillRule: path.fillRule,
  };
}

function textObject(hit: TextHit, index: number): ProjectObject {
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
    fill: "#171717",
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
