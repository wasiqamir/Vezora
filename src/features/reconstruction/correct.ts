import type { ProjectDocument, ProjectObject } from "@/features/projects/document";
import type { TextHit } from "@/features/reconstruction/ocr";
import { pathBounds } from "@/features/reconstruction/paths";

const MAX_PATH = 200_000;

export type Correction = {
  document: ProjectDocument;
  error: string | null;
};

export function useVectorOutlines(document: ProjectDocument, textId: string): Correction {
  const text = document.objects.find((object) => object.id === textId && object.type === "text");
  if (!text) return { document, error: "That word was not found." };
  const covered = overlappingPathIds(document, text);
  if (covered.size === 0) {
    return { document, error: "No outlined letters were found under this word." };
  }
  return {
    error: null,
    document: {
      ...document,
      objects: document.objects.map((object) => {
        if (object.id === textId) return { ...object, visible: false };
        if (covered.has(object.id)) return { ...object, visible: true };
        return object;
      }),
    },
  };
}

export function useEditableText(document: ProjectDocument, textId: string): Correction {
  const text = document.objects.find((object) => object.id === textId && object.type === "text");
  if (!text) return { document, error: "That word was not found." };
  const covered = overlappingPathIds(document, text);
  return {
    error: null,
    document: {
      ...document,
      objects: document.objects.map((object) => {
        if (object.id === textId) return { ...object, visible: true };
        if (covered.has(object.id)) return { ...object, visible: false };
        return object;
      }),
    },
  };
}

/** Prefer live text over letter outlines so words do not double-print on the artboard. */
export function preferEditableText(document: ProjectDocument): ProjectDocument {
  let next = document;
  for (const object of document.objects) {
    if (object.type !== "text") continue;
    next = useEditableText(next, object.id).document;
  }
  return next;
}

/**
 * Prefer traced letter outlines over OCR text so Edit elements opens looking like the upload.
 * Switch a word to Text in the dialog when you need to retype it.
 */
export function preferVectorOutlines(document: ProjectDocument): ProjectDocument {
  let next = document;
  for (const object of document.objects) {
    if (object.type !== "text") continue;
    const result = useVectorOutlines(next, object.id);
    if (!result.error) next = result.document;
  }
  return next;
}

/**
 * Every mark piece becomes editable: live OCR words for retype/restyle, unlock paths/marks.
 * Letter outlines under a word stay hidden so Edit elements does not treat type as icon slices.
 */
export function preferEditableElements(document: ProjectDocument): ProjectDocument {
  const withText = preferEditableText(document);
  return {
    ...withText,
    objects: withText.objects.map((object) =>
      object.name === "Original" && object.type === "image"
        ? object
        : { ...object, locked: false },
    ),
  };
}

/**
 * Attach OCR hits as live text (artboard space). When letter-row bands are provided, each
 * word is placed on that band so letter path slices are covered and removed — click the
 * word to edit font, size, weight, and color in Style.
 */
export function attachLiveText(
  document: ProjectDocument,
  hits: TextHit[],
  imageWidth: number,
  imageHeight: number,
  bandsArtboard: Array<{ x: number; y: number; width: number; height: number }> = [],
): ProjectDocument {
  if (imageWidth < 1 || imageHeight < 1) return document;
  const scaleX = document.artboard.width / imageWidth;
  const scaleY = document.artboard.height / imageHeight;
  const background = document.artboard.background;
  const fill = contrastText(background);
  const existing = new Set(
    document.objects
      .filter((object) => object.type === "text" && object.text?.trim())
      .map((object) => (object.text ?? "").trim().toLowerCase()),
  );
  const texts: ProjectObject[] = [];
  const usedHits = new Set<number>();

  // Prefer one text object per traced letter-row — geometry from the band, label from OCR.
  for (const [bandIndex, band] of bandsArtboard.entries()) {
    let bestIndex = -1;
    let bestScore = -1;
    for (const [hitIndex, hit] of hits.entries()) {
      if (usedHits.has(hitIndex)) continue;
      const label = hit.text.trim();
      if (!label || label.includes(" ") || existing.has(label.toLowerCase())) continue;
      const box = {
        x: hit.x * scaleX,
        y: hit.y * scaleY,
        width: hit.width * scaleX,
        height: hit.height * scaleY,
      };
      if (!overlaps(band, box)) continue;
      const score = (hit.confidence ?? 50) + Math.min(box.width, band.width) / Math.max(band.width, 1);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = hitIndex;
      }
    }
    if (bestIndex < 0) continue;
    const hit = hits[bestIndex]!;
    const label = hit.text.trim();
    usedHits.add(bestIndex);
    existing.add(label.toLowerCase());
    texts.push(
      liveTextObject({
        index: bandIndex,
        label,
        x: band.x,
        y: band.y,
        width: band.width,
        height: band.height,
        fill,
        confidence: hit.confidence,
      }),
    );
  }

  // Remaining OCR hits (no band) still become editable words.
  for (const [hitIndex, hit] of hits.entries()) {
    if (usedHits.has(hitIndex)) continue;
    const label = hit.text.trim();
    if (!label || existing.has(label.toLowerCase())) continue;
    // Prefer split words over a glued "BLOOM ATELIER" line when parts already exist.
    if (label.includes(" ")) {
      const parts = label.split(/\s+/).filter(Boolean);
      if (parts.every((part) => existing.has(part.toLowerCase()))) continue;
    }
    existing.add(label.toLowerCase());
    texts.push(
      liveTextObject({
        index: texts.length,
        label,
        x: hit.x * scaleX,
        y: hit.y * scaleY,
        width: hit.width * scaleX,
        height: hit.height * scaleY,
        fill,
        confidence: hit.confidence,
      }),
    );
  }

  if (texts.length === 0) return document;
  return {
    ...document,
    objects: [...document.objects, ...texts],
  };
}

function liveTextObject(input: {
  index: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  confidence?: number;
}): ProjectObject {
  const width = Math.max(8, round(input.width));
  const height = Math.max(8, round(input.height));
  return {
    id: `obj_text_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    type: "text",
    name: input.label.slice(0, 40) || `Text ${input.index + 1}`,
    text: input.label,
    x: round(input.x),
    y: round(input.y),
    width,
    height,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: input.fill,
    fontFamily: "Outfit",
    fontId: "outfit",
    fontSize: Math.max(12, Math.min(240, Math.round(height * 0.82))),
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.16,
    textAlign: "left",
    ...(typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? { confidence: Math.max(0, Math.min(100, Math.round(input.confidence))) }
      : {}),
  };
}

function contrastText(background: string | null) {
  if (!background || !/^#[0-9a-fA-F]{6}$/.test(background)) return "#171717";
  return luma(background) < 0.55 ? "#ffffff" : "#171717";
}

/**
 * Horizontal clusters of traced letter paths (or a single wide word path) — artboard space.
 * Used to OCR each word row and place one live text object over the whole word.
 */
export function textLikeBands(document: ProjectDocument) {
  const boardArea = Math.max(1, document.artboard.width * document.artboard.height);
  const letters = document.objects.filter((object) => {
    if (object.type !== "path" || !object.path || object.visible === false) return false;
    const width = Math.abs(object.width * object.scaleX);
    const height = Math.abs(object.height * object.scaleY);
    const area = width * height;
    // Skip large marks (icons) and dust; keep letter-sized and whole-word outlines.
    if (area / boardArea > 0.12) return false;
    if (area < boardArea * 0.00015 && Math.min(width, height) < 6) return false;
    return height >= 6 && width >= 3;
  });
  if (letters.length === 0) return [] as Array<{ x: number; y: number; width: number; height: number }>;

  const sorted = [...letters].sort((left, right) => bounds(left).y - bounds(right).y);
  const bands: Array<{ x: number; y: number; width: number; height: number; count: number }> = [];
  for (const object of sorted) {
    const box = bounds(object);
    const midY = box.y + box.height / 2;
    const open = bands.find((band) => Math.abs(midY - (band.y + band.height / 2)) <= Math.max(14, band.height * 0.55));
    if (!open) {
      bands.push({ x: box.x, y: box.y, width: box.width, height: box.height, count: 1 });
      continue;
    }
    const right = Math.max(open.x + open.width, box.x + box.width);
    const bottom = Math.max(open.y + open.height, box.y + box.height);
    open.x = Math.min(open.x, box.x);
    open.y = Math.min(open.y, box.y);
    open.width = right - open.x;
    open.height = bottom - open.y;
    open.count += 1;
  }
  return bands
    .filter(
      (band) =>
        band.width >= band.height * 1.15 &&
        (band.count >= 2 || band.width >= Math.max(48, band.height * 2.2)),
    )
    .map(({ x, y, width, height }) => ({ x, y, width, height }));
}

/** Pixel-identical word piece cut from the upload (has OCR `text`, not the Logo plate). */
export function isWordImageSlice(object: ProjectObject) {
  return (
    object.type === "image" &&
    object.name !== "Logo" &&
    object.name !== "Original" &&
    Boolean(object.text?.trim())
  );
}

/**
 * Retype / restyle a word: image slices become live text (only that word loses pixel identity).
 * Already-live text objects are patched in place.
 */
export function promoteWordSliceToLiveText(
  document: ProjectDocument,
  objectId: string,
  patch: {
    text?: string;
    fontId?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    fill?: string;
  } = {},
): Correction {
  const object = document.objects.find((item) => item.id === objectId);
  if (!object) return { document, error: "That word was not found." };

  if (object.type === "text") {
    const label = patch.text !== undefined ? patch.text : (object.text ?? "");
    return {
      error: null,
      document: {
        ...document,
        objects: document.objects.map((item) =>
          item.id !== objectId
            ? item
            : {
                ...item,
                ...(patch.text !== undefined
                  ? { text: label, name: label.trim().slice(0, 40) || item.name }
                  : {}),
                ...(patch.fontId !== undefined ? { fontId: patch.fontId } : {}),
                ...(patch.fontFamily !== undefined ? { fontFamily: patch.fontFamily } : {}),
                ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
                ...(patch.fontWeight !== undefined ? { fontWeight: patch.fontWeight } : {}),
                ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
              },
        ),
      },
    };
  }

  if (!isWordImageSlice(object)) {
    return { document, error: "Only word slices can become editable text." };
  }

  const label = (patch.text ?? object.text ?? object.name).trim();
  if (!label) return { document, error: "That word has no text to edit." };

  const boxWidth = Math.max(8, Math.abs(object.width * object.scaleX));
  const boxHeight = Math.max(8, Math.abs(object.height * object.scaleY));
  const inkRatio = 0.75;
  const fontSize =
    patch.fontSize ?? Math.max(12, Math.min(220, Math.round(boxHeight / inkRatio)));
  const live: ProjectObject = {
    id: object.id,
    type: "text",
    name: label.slice(0, 40),
    text: label,
    x: object.x,
    y: object.y,
    width: Math.max(24, Math.round(boxWidth)),
    height: Math.max(8, Math.round(Math.max(boxHeight, fontSize * inkRatio))),
    scaleX: 1,
    scaleY: 1,
    angle: object.angle,
    opacity: object.opacity,
    visible: true,
    locked: false,
    fill: patch.fill ?? contrastText(document.artboard.background),
    fontSize,
    fontId: patch.fontId ?? "outfit",
    fontFamily: patch.fontFamily ?? "Outfit",
    fontWeight: patch.fontWeight ?? 500,
    letterSpacing: 0,
    lineHeight: 1.16,
    textAlign: "left",
    ...(object.confidence !== undefined ? { confidence: object.confidence } : {}),
  };

  return {
    error: null,
    document: {
      ...document,
      objects: document.objects.map((item) => (item.id === objectId ? live : item)),
    },
  };
}

/**
 * Exact upload as Logo (with holes) + clipped pieces for marks and words.
 * Word bands become one image slice each from the upload — pixel-identical, movable as a unit.
 * Letter outlines under a word are not kept as separate slices (the word band carries them).
 * Full-board plates are skipped — Logo carries that exact content (and anything tracer missed).
 * Pieces do not punch each other; only Logo is punched, so moving a piece leaves a clean hole.
 * Retype or change font later via promoteWordSliceToLiveText — only that word becomes live text.
 */
export function asExactEditablePieces(
  document: ProjectDocument,
  upload: ProjectObject,
): ProjectDocument {
  const assetId = upload.assetId;
  if (!assetId) return document;

  const boardWidth = Math.max(1, document.artboard.width);
  const boardHeight = Math.max(1, document.artboard.height);
  const boardArea = boardWidth * boardHeight;
  // Prefer the upload's placed size so Logo pixels line up with how Original was fitted.
  const logoWidth = Math.max(1, Math.round(Math.abs((upload.width || boardWidth) * (upload.scaleX || 1))));
  const logoHeight = Math.max(1, Math.round(Math.abs((upload.height || boardHeight) * (upload.scaleY || 1))));
  const logoX = upload.x || 0;
  const logoY = upload.y || 0;

  const words = document.objects.filter(
    (object) => object.type === "text" && Boolean(object.text?.trim()),
  );
  // Paths under a word are letters — fold into the word-band image slice instead.
  const letterPathIds = new Set<string>();
  for (const word of words) {
    for (const id of overlappingPathIds(document, word, wordPad(word))) letterPathIds.add(id);
  }

  const paths: ProjectObject[] = [];
  for (const object of document.objects) {
    if (object.type !== "path" || !object.path) continue;
    // Include hidden letter outlines so word-band holes still clear Logo under the slice.
    if (object.visible === false && !letterPathIds.has(object.id)) continue;
    const width = Math.abs(object.width * object.scaleX);
    const height = Math.abs(object.height * object.scaleY);
    const area = width * height;
    // Skip near-full plates — Logo carries that exact content.
    if (area / boardArea > 0.5) continue;
    // Skip dust that only makes the mark look broken.
    if (area < boardArea * 0.00035 && Math.min(width, height) < 14) continue;
    paths.push(object);
  }

  // Large → small: bigger regions sit under finer details.
  const sorted = [...paths].sort(
    (left, right) =>
      Math.abs(right.width * right.scaleX) * Math.abs(right.height * right.scaleY) -
      Math.abs(left.width * left.scaleX) * Math.abs(left.height * left.scaleY),
  );

  const markPaths = sorted.filter((object) => !letterPathIds.has(object.id));

  const pieces = markPaths.map((object) => {
    // Crop must match the path, not a drifted draft x/y — otherwise slices load empty and rings stay on Logo.
    const box = pathBounds(object.path!) ?? {
      x: object.x,
      y: object.y,
      width: Math.max(1, Math.abs(object.width * object.scaleX)),
      height: Math.max(1, Math.abs(object.height * object.scaleY)),
    };
    return {
      id: object.id,
      type: "image" as const,
      name: object.name,
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      scaleX: 1,
      scaleY: 1,
      angle: upload.angle,
      opacity: 1,
      visible: true,
      locked: false,
      assetId,
      path: object.path!,
      fillRule: (object.fillRule === "evenodd" ? "evenodd" : "nonzero") as "evenodd" | "nonzero",
    };
  });

  // One exact-pixel slice per detected word (BLOOM / ATELIER) — not a substituted font.
  const wordPieces = words.map((word) => {
    const box = bounds(word);
    const label = (word.text ?? word.name).trim().slice(0, 40) || "Word";
    return {
      id: word.id,
      type: "image" as const,
      name: label,
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      scaleX: 1,
      scaleY: 1,
      angle: upload.angle,
      opacity: 1,
      visible: true,
      locked: false,
      assetId,
      path: rectPath(box),
      fillRule: "nonzero" as const,
      text: word.text,
      confidence: word.confidence,
    };
  });

  // Punch mark + word slices out of Logo so moving a piece leaves a clean hole (no ghost).
  const holePaths = [
    ...markPaths.map((object) => object.path).filter((value): value is string => Boolean(value)),
    ...wordPieces.map((word) => word.path),
  ];
  let clipSubtract: string | undefined;
  if (holePaths.length > 0) {
    const joined = holePaths.join(" ");
    if (joined.length <= MAX_PATH) clipSubtract = joined;
  }

  const logo: ProjectObject = {
    id: upload.id,
    type: "image",
    name: "Logo",
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
    scaleX: 1,
    scaleY: 1,
    angle: upload.angle,
    opacity: 1,
    // Exact upload plate; holes under pieces keep the board pixel-identical until a part moves.
    visible: true,
    // Lock the plate so clicks hit the movable pieces on top; unlock in Layers if needed.
    locked: true,
    assetId,
    // Exact upload pixels. Holes under pieces so moving a part leaves no ghost copy.
    path: `M ${logoX} ${logoY} H ${logoX + logoWidth} V ${logoY + logoHeight} H ${logoX} Z`,
    fillRule: "nonzero",
    ...(clipSubtract ? { clipSubtract } : {}),
  };

  return {
    ...document,
    // Logo at the back; mark + word slices on top — all from the same upload pixels.
    objects: [logo, ...pieces, ...wordPieces],
  };
}

function luma(hex: string) {
  const value = hex.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function mergePaths(document: ProjectDocument, ids: string[]): Correction {
  const chosen = document.objects.filter(
    (object) => ids.includes(object.id) && object.type === "path" && object.path,
  );
  if (chosen.length < 2) return { document, error: "Select at least two shapes to merge." };
  if (chosen.some((object) => object.scaleX !== 1 || object.scaleY !== 1)) {
    return { document, error: "Set scale back to 100% before merging." };
  }
  const path = chosen.map((object) => object.path).join(" ");
  if (path.length > MAX_PATH) return { document, error: "Those shapes are too detailed to merge." };
  const first = chosen[0];
  if (!first) return { document, error: "Select at least two shapes to merge." };
  const drop = new Set(chosen.slice(1).map((object) => object.id));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const object of chosen) {
    const box = bounds(object);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const merged: ProjectObject = {
    ...first,
    name: "Merged",
    path,
    x: round(minX),
    y: round(minY),
    width: Math.max(1, round(maxX - minX)),
    height: Math.max(1, round(maxY - minY)),
    scaleX: 1,
    scaleY: 1,
    fillRule: "nonzero",
  };
  return {
    error: null,
    document: {
      ...document,
      objects: document.objects.flatMap((object) => {
        if (object.id === first.id) return [merged];
        if (drop.has(object.id)) return [];
        return [object];
      }),
    },
  };
}

function overlappingPathIds(document: ProjectDocument, text: ProjectObject, pad = 0) {
  const word = paddedBounds(text, pad);
  const ids = new Set<string>();
  for (const object of document.objects) {
    if (object.type !== "path" || !object.path) continue;
    if (overlaps(word, bounds(object))) ids.add(object.id);
  }
  return ids;
}

/** Modest pad when deciding which paths are letters under a word (avoid swallowing nearby marks). */
function wordPad(word: ProjectObject) {
  return Math.max(16, Math.round(Math.abs(word.height * word.scaleY) * 0.35));
}

function paddedBounds(object: ProjectObject, pad: number) {
  const box = bounds(object);
  return {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

function rectPath(box: { x: number; y: number; width: number; height: number }) {
  const x = round(box.x);
  const y = round(box.y);
  const right = round(box.x + box.width);
  const bottom = round(box.y + box.height);
  return `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`;
}

function bounds(object: ProjectObject) {
  return {
    x: object.x,
    y: object.y,
    width: Math.abs(object.width * object.scaleX),
    height: Math.abs(object.height * object.scaleY),
  };
}

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
