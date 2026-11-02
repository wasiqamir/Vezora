import type { ProjectDocument, ProjectObject } from "@/features/projects/document";

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

function overlappingPathIds(document: ProjectDocument, text: ProjectObject) {
  const word = bounds(text);
  const ids = new Set<string>();
  for (const object of document.objects) {
    if (object.type !== "path" || !object.path) continue;
    if (overlaps(word, bounds(object))) ids.add(object.id);
  }
  return ids;
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
