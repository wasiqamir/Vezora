import type { ProjectDocument, ProjectObject } from "@/features/projects/document";
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
 * Exact upload as Logo (with holes) + clipped pieces for marks + live OCR words.
 * Letter outlines under a detected word become one editable text object (font/size/color).
 * Full-board plates are skipped — Logo carries that exact content (and anything tracer missed).
 * Pieces do not punch each other; only Logo is punched, so moving a piece leaves a clean hole.
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
  // Paths under a word (with padding) are letters / letter rings — never keep them as slices.
  const letterPathIds = new Set<string>();
  for (const word of words) {
    for (const id of overlappingPathIds(document, word, wordPad(word))) letterPathIds.add(id);
  }

  const paths: ProjectObject[] = [];
  for (const object of document.objects) {
    if (object.type !== "path" || !object.path) continue;
    // Include hidden letter outlines so Logo still gets holes under live words.
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

  // Size live words first so word-band punches cover the real em box (not just the OCR ink).
  const texts = words.map((word) => editableWordFromLetters(document, word, document.artboard.background));

  // Punch mark pieces out of Logo. Punch clean padded word rects (not letter outlines) so live
  // text sits on a flat hole — letter-shaped subtracts leave thick fringe under Bodoni/Outfit.
  const holePaths = [
    ...markPaths.map((object) => object.path).filter((value): value is string => Boolean(value)),
    ...texts.map((word) => rectPath(paddedBounds(word, textBandPad(word)))),
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
    // Keep the exact upload plate visible so the artboard matches Original; holes under
    // pieces + live words remove ghosts without dropping the dark mark board.
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
    // Logo at the back; mark slices + live words on top — no letter ghosts.
    objects: [logo, ...pieces, ...texts],
  };
}

/**
 * Promote an OCR word to editable text sized to the upload's ink box.
 * OCR fontSize alone is often too small — fit em size + tracking to the detected bounds.
 */
function editableWordFromLetters(
  document: ProjectDocument,
  word: ProjectObject,
  background: string | null,
): ProjectObject {
  const label = (word.text ?? "").trim();
  const boxHeight = Math.max(8, Math.abs(word.height * word.scaleY));
  const boxWidth = Math.max(8, Math.abs(word.width * word.scaleX));
  const darkBoard = luma(background && /^#[0-9a-fA-F]{6}$/.test(background) ? background : "#111122") < 0.4;
  // Short display words → Didot-like serif; longer/smaller lines → spaced sans tagline.
  const tagline =
    label.length >= 6 && boxHeight <= Math.max(48, Math.round(document.artboard.height * 0.06));
  // Capitals fill ~75% of the em (serif) / ~72% (sans). Size the em to the ink box height.
  const inkRatio = tagline ? 0.72 : 0.75;
  const fontSize = Math.max(12, Math.min(220, Math.round(boxHeight / inkRatio)));
  // Average uppercase advance (no tracking) — then solve tracking so the word spans boxWidth.
  const avgChar = tagline ? 0.62 : 0.76;
  const gaps = Math.max(1, label.length - 1);
  const baseWidth = label.length * fontSize * avgChar;
  const rawTracking = ((boxWidth - baseWidth) / gaps / fontSize) * 1000;
  const letterSpacing = Math.round(
    Math.max(tagline ? 120 : 0, Math.min(tagline ? 900 : 180, rawTracking)),
  );
  const width = Math.max(24, Math.round(boxWidth));
  const height = Math.max(8, Math.round(Math.max(boxHeight, fontSize * inkRatio)));
  return {
    ...word,
    type: "text",
    visible: true,
    locked: false,
    opacity: 1,
    // Match the upload: light ink on dark boards, never a muddy sampled pink ghost.
    fill: darkBoard ? "#ffffff" : pickReadableFill([], word.fill, background),
    fontSize,
    width,
    height,
    scaleX: 1,
    scaleY: 1,
    fontId: tagline ? "outfit" : "bodoni-moda",
    fontFamily: tagline ? "Outfit" : "Bodoni Moda",
    fontWeight: tagline ? 500 : 700,
    letterSpacing,
  };
}

/** Prefer a letter fill that stays readable on the artboard; fall back to white/black. */
function pickReadableFill(
  letterFills: string[],
  wordFill: string | null | undefined,
  background: string | null,
): string {
  const readable = (color: string) => contrastAgainst(color, background) >= 0.28;
  const bestLetter = bestContrast(letterFills, background);
  if (bestLetter && readable(bestLetter)) return bestLetter;
  if (typeof wordFill === "string" && /^#[0-9a-fA-F]{6}$/.test(wordFill) && readable(wordFill)) {
    return wordFill;
  }
  return bestContrast(["#ffffff", "#171717"], background) ?? "#ffffff";
}

function bestContrast(colors: string[], background: string | null) {
  let best: string | null = null;
  let bestScore = -1;
  for (const color of colors) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) continue;
    const score = contrastAgainst(color, background);
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  return best;
}

function contrastAgainst(color: string, background: string | null) {
  const fg = luma(color);
  const bg = background && /^#[0-9a-fA-F]{6}$/.test(background) ? luma(background) : 0.08;
  return Math.abs(fg - bg);
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

/** Generous pad for Logo punches under fitted live text (em box is taller than OCR ink). */
function textBandPad(word: ProjectObject) {
  const boxHeight = Math.max(8, Math.abs(word.height * word.scaleY));
  const fontSize = Math.max(boxHeight, word.fontSize ?? boxHeight);
  return Math.max(36, Math.round(fontSize * 0.55));
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
