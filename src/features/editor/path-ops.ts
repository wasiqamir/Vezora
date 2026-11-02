import { FabricObject, Group } from "fabric";
import {
  guideOf,
  isClosedOutline,
  outlineOf,
  solidPaint,
  strokePaint,
  type FillRule,
  type Outline,
  OutlineError,
} from "@/features/editor/path-geometry";

export type CombineOp = "unite" | "subtract" | "intersect";

export type PathResult = {
  d: string;
  fillRule: FillRule;
  fill: string;
};

type PaperModule = paper.PaperScope;
type PaperShape = paper.Path | paper.CompoundPath;

let paperScope: PaperModule | null = null;

async function loadPaper() {
  if (paperScope?.project) return paperScope;
  const loaded = await import("paper");
  const paper = loaded.default;
  if (!paper.project) paper.setup(document.createElement("canvas"));
  paperScope = paper;
  return paper;
}

function itemFromOutline(paper: PaperModule, outline: Outline): PaperShape {
  const subpaths = outline.d.split(/(?=M)/i).filter((part) => part.trim());
  const item =
    subpaths.length > 1 ? new paper.CompoundPath(outline.d) : new paper.Path(outline.d);
  item.fillRule = outline.fillRule;
  item.closed = isClosedOutline(outline);
  return item;
}

function asShape(item: paper.PathItem): PaperShape {
  if (item instanceof paperScope!.Path || item instanceof paperScope!.CompoundPath) return item;
  throw new OutlineError("Nothing was left after that combination.");
}

async function paperItem(paper: PaperModule, object: FabricObject): Promise<PaperShape> {
  if (object instanceof Group) {
    const children = object.getObjects();
    if (children.length === 0) throw new OutlineError("That symbol has no outline.");
    let combined = await paperItem(paper, children[0]);
    for (const child of children.slice(1)) {
      const next = await paperItem(paper, child);
      combined = asShape(combined.unite(next, { insert: false }));
    }
    return combined;
  }
  const outline = outlineOf(object);
  if (!isClosedOutline(outline)) {
    throw new OutlineError("Close the path before combining it.");
  }
  const item = itemFromOutline(paper, outline);
  if (!Number.isFinite(item.area) || Math.abs(item.area) < 0.01) {
    throw new OutlineError("That shape has no outline.");
  }
  return item;
}

function resultOf(item: PaperShape, fillRule: FillRule, fill: string): PathResult {
  const area = Math.abs(item.area ?? 0);
  if (!Number.isFinite(area) || area < 0.01 || !item.pathData) {
    throw new OutlineError("Nothing was left after that combination.");
  }
  return { d: item.pathData, fillRule, fill };
}

export async function combineOutlines(objects: FabricObject[], op: CombineOp): Promise<PathResult> {
  if (objects.length < 2) throw new OutlineError("Select two or more shapes.");
  const paper = await loadPaper();
  paper.project.clear();
  try {
    const items = [];
    for (const object of objects) items.push(await paperItem(paper, object));
    let result = items[0];
    for (const item of items.slice(1)) {
      if (op === "unite") result = asShape(result.unite(item, { insert: false }));
      else if (op === "subtract") result = asShape(result.subtract(item, { insert: false }));
      else result = asShape(result.intersect(item, { insert: false }));
    }
    const fillRule = op === "subtract" || result.fillRule === "evenodd" ? "evenodd" : "nonzero";
    return resultOf(result, fillRule, solidPaint(objects[0]));
  } finally {
    paper.project.clear();
  }
}

export async function offsetOutline(object: FabricObject, distance: number): Promise<PathResult> {
  if (!Number.isFinite(distance) || distance === 0) {
    throw new OutlineError("Enter an offset other than zero.");
  }
  const paper = await loadPaper();
  const { offset } = await import("paperjs-offset");
  paper.project.clear();
  try {
    const source = await paperItem(paper, object);
    const magnitude = Math.abs(distance);
    let expanded = offset(source, magnitude, { join: "round", insert: false });
    const grew = Math.abs(expanded.area) > Math.abs(source.area) + 0.01;
    if ((distance > 0 && !grew) || (distance < 0 && grew)) {
      expanded = offset(source, -magnitude, { join: "round", insert: false });
    }
    const fillRule = expanded.fillRule === "evenodd" ? "evenodd" : "nonzero";
    try {
      return resultOf(expanded, fillRule, solidPaint(object));
    } catch (error) {
      if (error instanceof OutlineError) throw new OutlineError("That offset left nothing.");
      throw error;
    }
  } catch (error) {
    if (error instanceof OutlineError) throw error;
    throw new OutlineError("That outline could not be offset.");
  } finally {
    paper.project.clear();
  }
}

function strokeReach(object: FabricObject) {
  const width = object.strokeWidth ?? 0;
  if (width <= 0) return 0;
  if (object.strokeUniform) return width / 2;
  const scale = (Math.abs(object.scaleX || 1) + Math.abs(object.scaleY || 1)) / 2 || 1;
  return (width * scale) / 2;
}

export async function strokeToFill(object: FabricObject): Promise<PathResult> {
  const color = strokePaint(object);
  const reach = strokeReach(object);
  if (!color || reach <= 0) throw new OutlineError("Set a stroke color and width first.");
  const paper = await loadPaper();
  const { offsetStroke } = await import("paperjs-offset");
  paper.project.clear();
  try {
    const guide = guideOf(object);
    const source = itemFromOutline(paper, { d: guide.d, fillRule: "nonzero" });
    const expanded = asShape(offsetStroke(source, reach, { join: "round", cap: "round", insert: false }));
    const commands = expanded.pathData?.split(/(?=M)/i).filter((part) => part.trim()) ?? [];
    const fillRule = commands.length > 1 || expanded.fillRule === "evenodd" ? "evenodd" : "nonzero";
    return resultOf(expanded, fillRule, color);
  } catch (error) {
    if (error instanceof OutlineError) throw error;
    throw new OutlineError("That stroke could not be outlined.");
  } finally {
    paper.project.clear();
  }
}
