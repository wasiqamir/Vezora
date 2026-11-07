import {
  ActiveSelection,
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricObject,
  IText,
  Line,
  Path,
  loadSVGFromString,
  Point,
  Polygon,
  Rect,
  StaticCanvas,
} from "fabric";
import { alignmentDelta, distributionDeltas, type AlignEdge } from "@/features/editor/align";
import {
  ARTBOARD_PRESETS,
  clampArtboardEdge,
  DEFAULT_ARTBOARD,
  matchArtboardPreset,
} from "@/features/editor/artboard";
import {
  buildSvgDocument,
  embedImageSource,
  exportFileName,
  objectsForExport,
  type ExportRequest,
} from "@/features/editor/export-file";
import { EditHistory } from "@/features/editor/history";
import {
  createArcObject,
  createCircleObject,
  createEllipseObject,
  createIconObject,
  createLineObject,
  createObjectId,
  createPathObject,
  createRectObject,
  createRingObject,
  createRoundRectObject,
  createStarObject,
  createTextObject,
  createTriangleObject,
  findLogoIcon,
  objectChildren,
  styleLogoObject,
} from "@/features/editor/objects";
import {
  anchorScenePoints,
  bakePath,
  moveAnchor,
  guideOf,
  OutlineError,
  outlineOf,
  penToSvg,
  solidPaint,
  type PenPoint,
} from "@/features/editor/path-geometry";
import { combineOutlines, offsetOutline, strokeToFill, type CombineOp } from "@/features/editor/path-ops";
import {
  preferExactUpload,
  projectFromScene,
  sceneFromProject,
  type ProjectDocument,
} from "@/features/projects/document";
import { pathBounds } from "@/features/reconstruction/paths";
import type { SceneDocument, SceneObject } from "@/features/editor/scene";
import type {
  ArtboardPresetId,
  EditorFontOption,
  EditorSnapshot,
  EditorTool,
  LogoObjectData,
  LogoObjectType,
  SelectionPatch,
  SelectionSnapshot,
} from "@/features/editor/types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const DEFAULT_FONT_ID = "outfit";

type Listener = (snapshot: EditorSnapshot) => void;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function hexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "transparent" || normalized === "none" || normalized === "") return null;
  const short = normalized.match(/^#([0-9a-f]{3})$/);
  if (short) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!rgb) return null;
  return `#${rgb
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = hexColor(value);
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export class CanvasController {
  private readonly canvas: Canvas;
  private readonly artboard: Rect;
  private readonly data = new Map<FabricObject, LogoObjectData>();
  /** Un-recolored clipped piece bitmaps — fill edits paint over a copy of these. */
  private readonly imagePieceBases = new WeakMap<FabricObject, HTMLCanvasElement>();
  private readonly counts = new Map<string, number>();
  private readonly listeners = new Set<Listener>();
  private readonly fonts: EditorFontOption[];
  private readonly history: EditHistory;
  private readonly guides: Line[] = [];
  private observer: ResizeObserver | null = null;
  private emitFrame = 0;
  private commitTimer = 0;
  private ready = false;
  private restoring = false;
  private placed = 0;
  private snapEnabled = true;
  private error: string | null = null;
  private tool: EditorTool = "select";
  private zoomPercent = 100;
  private readonly openTool: EditorTool;
  private offsetDistance = 28;
  private revision = 0;
  private openStarted = false;
  private userAdjustedZoom = false;
  private readonly host: HTMLElement;
  private reconstruction: ProjectDocument["reconstruction"] | null = null;
  private imageUrls = new Set<string>();
  private suppressRevision = false;
  private readonly initialDocument: ProjectDocument | null;
  private penPoints: PenPoint[] = [];
  private penDown: PenPoint | null = null;
  private penPreview: Path | null = null;
  private nodeDrag: { ordinal: number; lastX: number; lastY: number; moved: boolean } | null = null;
  private presetId: ArtboardPresetId = DEFAULT_ARTBOARD.presetId;
  private background: string | null = DEFAULT_ARTBOARD.background;
  private lastSolid = "#ffffff";

  constructor(input: {
    canvas: HTMLCanvasElement;
    host: HTMLElement;
    fonts: EditorFontOption[];
    document?: ProjectDocument;
    tool?: "select" | "pen";
  }) {
    this.fonts = input.fonts;
    this.host = input.host;
    this.openTool = input.tool === "pen" ? "pen" : "select";
    this.initialDocument = input.document ?? null;
    this.reconstruction = input.document?.reconstruction ?? null;
    this.canvas = new Canvas(input.canvas, {
      width: input.host.clientWidth || 800,
      height: input.host.clientHeight || 600,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
    });
    const element = this.canvas.getElement();
    element.style.background = "transparent";
    if (element.parentElement) element.parentElement.style.background = "transparent";

    this.artboard = new Rect({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: DEFAULT_ARTBOARD.width,
      height: DEFAULT_ARTBOARD.height,
      fill: DEFAULT_ARTBOARD.background,
      stroke: "#c8c8c8",
      strokeWidth: 1,
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: "default",
    });
    this.canvas.add(this.artboard);
    this.history = new EditHistory(this.serialize());
    this.canvas.on("selection:created", () => this.onSelection());
    this.canvas.on("selection:updated", () => this.onSelection());
    this.canvas.on("selection:cleared", () => this.onSelection());
    this.canvas.on("object:modified", () => this.onModified());
    this.canvas.on("text:editing:exited", () => this.onModified());
    this.canvas.on("mouse:up", () => this.clearGuides());
    this.canvas.on("mouse:down", (options) => this.onPointerDown(options));
    this.canvas.on("mouse:move", (options) => this.onPointerMove(options));
    this.canvas.on("mouse:up", (options) => this.onPointerUp(options));
    this.canvas.on("mouse:dblclick", () => this.onDoubleClick());
    this.canvas.on("after:render", () => this.drawToolOverlay());
    this.canvas.on("object:moving", (options) => this.snap(options.target));
    this.canvas.on("mouse:wheel", (options) => {
      const event = options.e;
      event.preventDefault();
      event.stopPropagation();
      const next = clamp(this.canvas.getZoom() * 0.999 ** event.deltaY, MIN_ZOOM, MAX_ZOOM);
      this.userAdjustedZoom = true;
      this.canvas.zoomToPoint(options.viewportPoint, next);
      const percent = Math.round(next * 100);
      if (percent === this.zoomPercent) return;
      this.zoomPercent = percent;
      this.emitSoon();
    });

    this.observer = new ResizeObserver(() => this.resize(input.host));
    this.observer.observe(input.host);
    this.resize(input.host);
    window.addEventListener("keydown", this.onKeyDown);
    void document.fonts.ready.then(() => {
      if (!this.canvas.destroyed) this.canvas.requestRenderAll();
    });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.createSnapshot());
    return () => this.listeners.delete(listener);
  }

  dispose() {
    for (const url of this.imageUrls) URL.revokeObjectURL(url);
    this.imageUrls.clear();
    this.cancelPen();
    window.removeEventListener("keydown", this.onKeyDown);
    this.observer?.disconnect();
    if (this.emitFrame) cancelAnimationFrame(this.emitFrame);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.listeners.clear();
    this.canvas.dispose();
  }

  addText() {
    const fontId = this.fonts.some((font) => font.id === DEFAULT_FONT_ID)
      ? DEFAULT_FONT_ID
      : (this.fonts[0]?.id ?? DEFAULT_FONT_ID);
    const created = createTextObject({
      id: createObjectId(),
      name: this.nextName("text", "Wordmark"),
      canvasFamily: this.canvasFamily(fontId),
      fontId,
    });
    this.addObject(created.object, created.data);
    this.paintFont(created.object);
  }

  addRect() {
    const created = createRectObject({
      id: createObjectId(),
      name: this.nextName("rect", "Rectangle"),
    });
    this.addObject(created.object, created.data);
  }

  addEllipse() {
    const created = createEllipseObject({
      id: createObjectId(),
      name: this.nextName("ellipse", "Ellipse"),
    });
    this.addObject(created.object, created.data);
  }

  addLine() {
    const created = createLineObject({
      id: createObjectId(),
      name: this.nextName("line", "Line"),
    });
    this.addObject(created.object, created.data);
  }

  addCircle() {
    const created = createCircleObject({
      id: createObjectId(),
      name: this.nextName("ellipse", "Circle"),
    });
    this.addObject(created.object, created.data);
  }

  addRoundRect() {
    const created = createRoundRectObject({
      id: createObjectId(),
      name: this.nextName("rect", "Rounded"),
    });
    this.addObject(created.object, created.data);
  }

  addTriangle() {
    const created = createTriangleObject({
      id: createObjectId(),
      name: this.nextName("polygon", "Triangle"),
    });
    this.addObject(created.object, created.data);
  }

  addRing() {
    const created = createRingObject({
      id: createObjectId(),
      name: this.nextName("ellipse", "Ring"),
    });
    this.addObject(created.object, created.data);
  }

  addArc() {
    const created = createArcObject({
      id: createObjectId(),
      name: this.nextName("arc", "Arc"),
    });
    this.addObject(created.object, created.data);
  }

  addStar() {
    const created = createStarObject({
      id: createObjectId(),
      name: this.nextName("polygon", "Star"),
    });
    this.addObject(created.object, created.data);
  }

  flip(axis: "x" | "y") {
    const objects = this.contentObjects().filter((object) => object.lockMovementX !== true);
    if (objects.length === 0) return;
    for (const object of objects) {
      const key = axis === "x" ? "flipX" : "flipY";
      object.set(key, object[key] !== true);
      object.setCoords();
    }
    this.commit();
  }

  showError(message: string) {
    this.fail(message);
  }

  async addUploadedImage(assetId: string, url: string) {
    // FabricImage defaults to center/center; the rest of the editor positions by top-left.
    const image = await FabricImage.fromURL(url, {}, { originX: "left", originY: "top" });
    const { isGuestAssetId } = await import("@/features/editor/guest-assets");
    // Guest registry owns object URLs; only revoke canvas-created blobs on dispose.
    if (!isGuestAssetId(assetId)) this.imageUrls.add(url);
    const maxEdge = 320;
    const scale = Math.min(maxEdge / (image.width || maxEdge), maxEdge / (image.height || maxEdge), 1);
    image.set({ originX: "left", originY: "top", scaleX: scale, scaleY: scale });
    this.addObject(image, {
      id: createObjectId(),
      type: "image",
      name: this.nextName("image", "Image"),
      assetId,
    });
  }

  async addIcon(iconId: string) {
    const icon = findLogoIcon(iconId);
    if (!icon) return;
    try {
      const created = await createIconObject({ id: createObjectId(), icon });
      created.data.name = this.nextName("icon", icon.name);
      this.addObject(created.object, created.data);
    } catch {
      this.error = "That icon could not be added.";
      this.emit();
    }
  }

  async duplicate() {
    const selected = this.contentObjects();
    if (selected.length === 0) return;
    const clones: FabricObject[] = [];
    for (const object of selected) {
      const source = this.data.get(object);
      if (!source) continue;
      const clone = await object.clone();
      const data: LogoObjectData = {
        ...source,
        id: createObjectId(),
        name: `${source.name} copy`,
      };
      this.data.set(clone, data);
      styleLogoObject(clone);
      this.applyInteraction(clone, true, false);
      clone.set({
        left: (object.left ?? 0) + 32,
        top: (object.top ?? 0) + 32,
      });
      clone.setCoords();
      clones.push(clone);
    }
    if (clones.length === 0) return;
    const previousIds = this.selectionIds();
    this.canvas.discardActiveObject();
    for (const clone of clones) this.canvas.add(clone);
    this.canvas.sendObjectToBack(this.artboard);
    if (clones.length === 1) {
      this.canvas.setActiveObject(clones[0]);
    } else if (clones.length > 1) {
      this.canvas.setActiveObject(new ActiveSelection(clones, { canvas: this.canvas }));
    }
    this.history.setSelection(previousIds);
    this.canvas.requestRenderAll();
    this.commit();
  }

  deleteSelection() {
    const active = this.canvas.getActiveObject();
    if (active instanceof IText && active.isEditing) return;
    const selected = this.contentObjects();
    if (selected.length === 0) return;
    const previousIds = this.selectionIds();
    for (const object of selected) this.data.delete(object);
    this.canvas.remove(...selected);
    this.canvas.discardActiveObject();
    this.history.setSelection(previousIds);
    this.canvas.requestRenderAll();
    this.commit();
  }

  async setTool(tool: EditorTool) {
    if (tool === "nodes") {
      const selected = this.contentObjects();
      if (selected.length !== 1) {
        this.fail("Select one shape to edit its points.");
        return;
      }
      if (selected[0].lockMovementX === true) {
        this.fail("Unlock the shape before editing its points.");
        return;
      }
      try {
        if (this.data.get(selected[0])?.type !== "path") this.replaceWithOutline(selected[0]);
      } catch (error) {
        this.fail(error instanceof OutlineError ? error.message : "That shape has no points to edit.");
        return;
      }
    }
    this.cancelPen();
    this.nodeDrag = null;
    this.tool = tool;
    const drawing = tool !== "select";
    this.canvas.selection = !drawing;
    this.canvas.skipTargetFind = drawing;
    this.canvas.defaultCursor = tool === "pen" ? "crosshair" : "default";
    this.canvas.hoverCursor = tool === "pen" ? "crosshair" : "move";
    if (tool === "pen") this.canvas.discardActiveObject();
    for (const object of this.stack()) {
      this.applyInteraction(object, object.visible !== false, object.lockMovementX === true);
    }
    if (tool === "nodes") this.singleSelection()?.set({ hasControls: false });
    this.canvas.requestRenderAll();
    this.emit();
  }

  async combine(op: CombineOp) {
    const selected = this.contentObjects().filter(
      (object) => object.lockMovementX !== true && object.visible !== false,
    );
    if (selected.length < 2) {
      this.fail(
        this.contentObjects().length >= 2
          ? "Unlock the shapes before combining them."
          : "Select two or more shapes.",
      );
      return;
    }
    const ordered = this.stack().filter((object) => selected.includes(object));
    try {
      const result = await combineOutlines(ordered, op);
      const label = op === "unite" ? "Unite" : op === "subtract" ? "Subtract" : "Intersect";
      const created = createPathObject({
        id: createObjectId(),
        name: this.nextName("path", label),
        d: result.d,
        fillRule: result.fillRule,
      });
      created.object.set({ fill: result.fill, stroke: null, strokeWidth: 0 });
      const objects = this.canvas.getObjects();
      const index = objects.indexOf(ordered[0]);
      const removed = [...ordered].sort((a, b) => objects.indexOf(b) - objects.indexOf(a));
      for (const object of removed) {
        this.data.delete(object);
        this.canvas.remove(object);
      }
      this.placePath(created.object, created.data, index);
      this.canvas.setActiveObject(created.object);
      this.commit();
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "Those shapes could not be combined.");
    }
  }

  async offsetSelection() {
    const ordered = this.stack().filter((object) => this.movableObjects().includes(object));
    if (ordered.length === 0) {
      this.fail(this.contentObjects().length > 0 ? "Unlock the shape before offsetting it." : "Select a shape to offset.");
      return;
    }
    try {
      const results: { source: FabricObject; d: string; fillRule: "evenodd" | "nonzero"; fill: string }[] = [];
      for (const source of ordered) {
        const result = await offsetOutline(source, this.offsetDistance);
        results.push({ source, d: result.d, fillRule: result.fillRule, fill: result.fill });
      }
      const created: FabricObject[] = [];
      for (const item of results) {
        const path = createPathObject({
          id: createObjectId(),
          name: this.nextName("path", "Offset"),
          d: item.d,
          fillRule: item.fillRule,
        });
        path.object.set({
          fill: item.fill,
          stroke: null,
          strokeWidth: 0,
          opacity: item.source.opacity ?? 1,
        });
        this.placePath(path.object, path.data, this.canvas.getObjects().indexOf(item.source));
        created.push(path.object);
      }
      this.selectObjects(created);
      this.commit();
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "That outline could not be offset.");
    }
  }

  setOffsetDistance(distance: number) {
    const next = clamp(Math.round(distance), -400, 400);
    if (next === this.offsetDistance) return;
    this.offsetDistance = next;
    this.emit();
  }

  textOnPath() {
    const selected = this.contentObjects();
    if (selected.length === 0) {
      this.fail("Select one shape, or a shape and the text that should follow it.");
      return;
    }
    const movable = this.movableObjects();
    if (movable.length !== selected.length) {
      this.fail("Unlock the objects first.");
      return;
    }
    const texts = movable.filter((object): object is IText => object instanceof IText);
    const guides = movable.filter((object) => !(object instanceof IText));
    if (guides.length !== 1 || texts.length > 1) {
      this.fail(
        guides.length === 0
          ? "Select a shape for the text to follow."
          : "Select one shape, or a shape and the text that should follow it.",
      );
      return;
    }
    try {
      const guide = guideOf(guides[0]);
      let text = texts[0];
      let data = text ? this.data.get(text) : undefined;
      if (!text || !data) {
        const fontId = this.fonts.some((font) => font.id === DEFAULT_FONT_ID)
          ? DEFAULT_FONT_ID
          : (this.fonts[0]?.id ?? DEFAULT_FONT_ID);
        const created = createTextObject({
          id: createObjectId(),
          name: this.nextName("text", "Wordmark"),
          canvasFamily: this.canvasFamily(fontId),
          fontId,
        });
        text = created.object;
        data = created.data;
        this.data.set(text, data);
        styleLogoObject(text);
        this.applyInteraction(text, true, false);
        this.canvas.add(text);
      }
      const wording = (text.text ?? "Logo").replace(/\s*\n\s*/g, " ").trim() || "Logo";
      const path = new Path(guide.d, {
        visible: false,
        fill: "transparent",
        stroke: null,
        strokeWidth: 0,
      });
      text.set({
        text: wording,
        path,
        pathAlign: "center",
        pathSide: "left",
        textAlign: "center",
        pathStartOffset: 0,
        originX: "left",
        originY: "top",
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false,
      });
      text.setPathInfo();
      text.initDimensions();
      const width = text.width || path.width || 1;
      const height = text.height || path.height || 1;
      text.set({
        left: (path.pathOffset?.x ?? 0) - width / 2,
        top: (path.pathOffset?.y ?? 0) - height / 2,
      });
      text.setCoords();
      this.canvas.moveObjectTo(text, this.canvas.getObjects().length - 1);
      this.canvas.sendObjectToBack(this.artboard);
      this.paintFont(text);
      this.canvas.setActiveObject(text);
      this.commit();
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "That text could not follow the shape.");
    }
  }

  flipPathSide() {
    const object = this.singleSelection();
    if (!(object instanceof IText) || !object.path) {
      this.fail("That text is not on a path.");
      return;
    }
    object.set("pathSide", object.pathSide === "right" ? "left" : "right");
    object.setPathInfo();
    object.initDimensions();
    object.setCoords();
    this.commit();
  }

  straightenText() {
    const object = this.singleSelection();
    if (!(object instanceof IText) || !object.path) {
      this.fail("That text is not on a path.");
      return;
    }
    const center = object.getCenterPoint();
    object.set({ path: undefined, pathStartOffset: 0 });
    object.initDimensions();
    object.set({
      left: center.x - (object.width ?? 0) / 2,
      top: center.y - (object.height ?? 0) / 2,
    });
    object.setCoords();
    this.commit();
  }

  async outlineStroke() {
    const ordered = this.stack().filter((object) => this.movableObjects().includes(object));
    if (ordered.length === 0) {
      this.fail(this.contentObjects().length > 0 ? "Unlock the shape first." : "Select a shape with a stroke.");
      return;
    }
    try {
      const created: FabricObject[] = [];
      for (const source of ordered) {
        const result = await strokeToFill(source);
        const path = createPathObject({
          id: createObjectId(),
          name: this.nextName("path", "Outline"),
          d: result.d,
          fillRule: result.fillRule,
        });
        path.object.set({
          fill: result.fill,
          stroke: null,
          strokeWidth: 0,
          opacity: source.opacity ?? 1,
        });
        const index = this.canvas.getObjects().indexOf(source);
        const keepsFill = hexColor(source.fill) !== null && this.data.get(source)?.type !== "line";
        if (keepsFill) {
          this.applyStroke(source, null);
          this.applyStrokeWidth(source, 0);
          this.placePath(path.object, path.data, index + 1);
        } else {
          this.data.delete(source);
          this.canvas.remove(source);
          this.placePath(path.object, path.data, index);
        }
        created.push(path.object);
      }
      this.selectObjects(created);
      this.commit();
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "That stroke could not be outlined.");
    }
  }

  async importSvg(markup: string) {
    if (markup.length > 2_000_000) {
      this.fail("That SVG is too large.");
      return;
    }
    try {
      await this.importMarkup(markup, "SVG", false);
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "That SVG could not be imported.");
    }
  }

  async traceFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      this.fail("That image is too large.");
      return;
    }
    try {
      const response = await fetch("/api/trace", { method: "POST", body: file });
      const body = await response.text();
      if (!response.ok) {
        let message = "That image could not be traced.";
        try {
          const parsed = JSON.parse(body) as { error?: string | { message?: string } };
          if (typeof parsed.error === "string") message = parsed.error;
          else if (parsed.error?.message) message = parsed.error.message;
        } catch {
          message = "That image could not be traced.";
        }
        this.fail(message);
        return;
      }
      await this.importMarkup(body, "Trace", true);
    } catch (error) {
      this.fail(error instanceof OutlineError ? error.message : "That image could not be traced.");
    }
  }

  updateSelection(patch: SelectionPatch) {
    const object = this.singleSelection();
    if (!object) return;
    const data = this.data.get(object);
    if (!data) return;

    const locked = object.lockMovementX === true;
    if (patch.name !== undefined && patch.name.trim()) data.name = patch.name;
    if (patch.text !== undefined && object instanceof IText) object.set("text", patch.text);
    if (patch.fontId !== undefined && object instanceof IText) {
      data.fontId = patch.fontId;
      object.set("fontFamily", this.canvasFamily(patch.fontId));
    }
    if (patch.fontSize !== undefined && object instanceof IText) {
      object.set("fontSize", clamp(Math.round(patch.fontSize), 8, 500));
    }
    if (patch.fontWeight !== undefined && object instanceof IText) {
      object.set("fontWeight", patch.fontWeight);
    }
    if (patch.pathStartOffset !== undefined && object instanceof IText && object.path) {
      object.set("pathStartOffset", clamp(Math.round(patch.pathStartOffset), -2000, 2000));
    }
    if (
      object instanceof IText &&
      (patch.fontId !== undefined || patch.fontWeight !== undefined)
    ) {
      this.paintFont(object);
    }
    if (
      object instanceof IText &&
      object.path &&
      (patch.text !== undefined ||
        patch.fontId !== undefined ||
        patch.fontSize !== undefined ||
        patch.fontWeight !== undefined ||
        patch.pathStartOffset !== undefined)
    ) {
      object.setPathInfo();
      object.initDimensions();
    }
    if (data.type === "image") {
      // Clipped mark pieces (not the Logo plate) can be recolored via Fill.
      if (patch.fill !== undefined && object instanceof FabricImage && !this.isUploadImage(object)) {
        this.applyImagePieceFill(object, patch.fill);
      }
    } else {
      if (patch.fill !== undefined) this.applyFill(object, patch.fill);
      if (patch.stroke !== undefined) this.applyStroke(object, patch.stroke);
      if (patch.strokeWidth !== undefined) {
        this.applyStrokeWidth(object, clamp(Math.round(patch.strokeWidth), 0, 80));
      }
    }
    if (patch.cornerRadius !== undefined && object instanceof Rect) {
      const radius = clamp(Math.round(patch.cornerRadius), 0, 400);
      object.set({ rx: radius, ry: radius });
    }
    if (patch.opacity !== undefined) object.set("opacity", clamp(patch.opacity, 0, 1));
    if (!locked && patch.x !== undefined) object.set("left", patch.x);
    if (!locked && patch.y !== undefined) object.set("top", patch.y);
    if (!locked && (patch.width !== undefined || patch.height !== undefined)) {
      const width = Math.max(1, patch.width ?? object.getScaledWidth());
      const height = Math.max(1, patch.height ?? object.getScaledHeight());
      object.set({
        scaleX: width / (object.width || 1),
        scaleY: height / (object.height || 1),
      });
    }
    if (!locked && patch.angle !== undefined) object.rotate(patch.angle);
    object.setCoords();
    const debounced =
      patch.name !== undefined ||
      patch.text !== undefined ||
      patch.fontSize !== undefined ||
      patch.opacity !== undefined ||
      patch.fill !== undefined ||
      patch.stroke !== undefined;
    if (debounced) {
      this.canvas.requestRenderAll();
      this.emit();
      this.scheduleCommit();
      return;
    }
    this.commit();
  }

  zoomBy(factor: number) {
    this.userAdjustedZoom = true;
    const next = clamp(this.canvas.getZoom() * factor, MIN_ZOOM, MAX_ZOOM);
    const center = this.artboard.getCenterPoint();
    const screen = new Point(center.x, center.y).transform(this.canvas.viewportTransform);
    this.canvas.zoomToPoint(screen, next);
    this.zoomPercent = Math.round(next * 100);
    this.emit();
  }

  fit() {
    this.userAdjustedZoom = false;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    if (width < 2 || height < 2) return;
    const pad = Math.min(48, Math.max(12, Math.round(Math.min(width, height) * 0.08)));
    const zoom = clamp(
      Math.min(
        (width - pad * 2) / (this.artboard.width || 1),
        (height - pad * 2) / (this.artboard.height || 1),
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    this.canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (width - this.artboard.width * zoom) / 2,
      (height - this.artboard.height * zoom) / 2,
    ]);
    this.zoomPercent = Math.round(zoom * 100);
    this.emit();
  }

  setArtboardPreset(presetId: Exclude<ArtboardPresetId, "custom">) {
    const preset = ARTBOARD_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    this.setArtboardSize(preset.width, preset.height);
  }

  setArtboardSize(width: number, height: number) {
    const nextWidth = clampArtboardEdge(width);
    const nextHeight = clampArtboardEdge(height);
    this.artboard.set({ width: nextWidth, height: nextHeight, scaleX: 1, scaleY: 1 });
    this.artboard.setCoords();
    this.presetId = matchArtboardPreset(nextWidth, nextHeight);
    this.canvas.requestRenderAll();
    this.fit();
    this.commit();
  }

  setBackground(background: string | null) {
    this.background = background;
    if (background) this.lastSolid = background;
    this.artboard.set("fill", background ?? "rgba(0,0,0,0)");
    this.commit();
  }

  setSnap(enabled: boolean) {
    this.snapEnabled = enabled;
    if (!enabled) this.clearGuides();
    this.emit();
  }

  dismissError() {
    this.error = null;
    this.emit();
  }

  async createExport(input: ExportRequest) {
    await this.waitForExportAssets();
    const width = Math.round(this.artboard.width || 0);
    const height = Math.round(this.artboard.height || 0);
    if (width < 1 || height < 1) throw new Error("Export failed.");
    const background = input.background === "transparent" ? null : this.background;
    const filename = exportFileName(input.projectName, input.format, input.scale);
    try {
      if (input.format === "svg") {
        const shapes = objectsForExport(this.stack()).map((object) => this.markupForExport(object));
        const svg = buildSvgDocument({ width, height, background, shapes });
        return { filename, blob: new Blob([svg], { type: "image/svg+xml" }) };
      }
      const blob = await this.renderPng(width, height, input.scale, background);
      return { filename, blob };
    } catch (error) {
      if (error instanceof Error && error.message === "Export failed.") throw error;
      throw new Error("Export failed.");
    }
  }

  private async waitForExportAssets() {
    const specs = new Set<string>();
    const images: HTMLImageElement[] = [];
    for (const object of objectsForExport(this.stack())) {
      if (object instanceof IText) {
        const family = String(object.fontFamily ?? "")
          .split(",")[0]
          ?.trim()
          .replaceAll('"', "");
        if (family) specs.add(`${object.fontWeight ?? 500} ${object.fontSize ?? 72}px "${family}"`);
      }
      const image = this.imageElement(object);
      if (image) images.push(image);
    }
    try {
      await Promise.all([
        ...[...specs].map((spec) => document.fonts.load(spec)),
        ...images.map((image) => (image.complete ? Promise.resolve() : image.decode())),
      ]);
      await document.fonts.ready;
    } catch {
      throw new Error("Export failed.");
    }
  }

  private markupForExport(object: FabricObject) {
    const markup = object.toSVG();
    const image = this.imageElement(object);
    if (!image) return markup;
    const source = this.imageSource(object);
    if (!source || source.startsWith("data:")) return markup;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width < 1 || height < 1) throw new Error("Export failed.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Export failed.");
    context.drawImage(image, 0, 0);
    return embedImageSource(markup, source, canvas.toDataURL("image/png"));
  }

  private imageElement(object: FabricObject) {
    if (object.type !== "image") return null;
    const element = (object as FabricObject & { getElement?: () => unknown }).getElement?.();
    return element instanceof HTMLImageElement ? element : null;
  }

  private imageSource(object: FabricObject) {
    const source = (object as FabricObject & { getSrc?: () => string }).getSrc?.() ?? "";
    return source;
  }

  private async renderPng(width: number, height: number, scale: 1 | 2, background: string | null) {
    const element = document.createElement("canvas");
    const copy = new StaticCanvas(element, {
      width,
      height,
      enableRetinaScaling: false,
      backgroundColor: "rgba(0,0,0,0)",
      renderOnAddRemove: false,
    });
    try {
      if (background) {
        copy.add(
          new Rect({
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            width,
            height,
            fill: background,
            stroke: null,
            strokeWidth: 0,
            selectable: false,
            evented: false,
          }),
        );
      }
      for (const object of objectsForExport(this.stack())) {
        copy.add(await object.clone());
      }
      copy.renderAll();
      const blob = await copy.toBlob({
        format: "png",
        multiplier: scale,
        enableRetinaScaling: false,
      });
      if (!blob) throw new Error("Export failed.");
      return blob;
    } finally {
      copy.dispose();
    }
  }

  selectLayer(id: string, additive = false) {
    const object = this.findById(id);
    if (!object) return;
    if (!additive) {
      this.canvas.setActiveObject(object);
    } else {
      const current = this.contentObjects().filter((item) => item !== object);
      this.selectObjects([...current, object]);
    }
    this.canvas.requestRenderAll();
    this.emit();
  }

  reorder(id: string, direction: "forward" | "backward") {
    this.clearGuides();
    const object = this.findById(id);
    if (!object) return;
    const stack = this.stack();
    const index = stack.indexOf(object);
    if (direction === "forward") {
      if (index < 0 || index >= stack.length - 1) return;
      this.canvas.bringObjectForward(object);
    } else {
      if (index <= 0) return;
      this.canvas.sendObjectBackwards(object);
    }
    this.canvas.sendObjectToBack(this.artboard);
    this.commit();
  }

  toggleVisible(id: string) {
    const object = this.findById(id);
    if (!object) return;
    const showing = object.visible === false;
    const data = this.data.get(object);
    // Exact-upload mode: don't stack traced outlines on a full unpunched Logo (double print).
    // Piece mode punches Logo holes — marks and live text are meant to sit on top.
    // Live text is always allowed: words replace letter pixels, they do not double them.
    if (
      showing &&
      data &&
      data.type !== "text" &&
      this.reconstruction?.keepShapes !== true &&
      !(data.type === "image" && (data.name === "Original" || data.name === "Logo")) &&
      this.stack().some((item) => this.isUploadImage(item) && item.visible !== false)
    ) {
      return;
    }
    this.applyInteraction(object, showing, object.lockMovementX === true);
    // Only this layer — never mass-hide / mass-show the rest of the logo.
    if (!showing) {
      const selected = this.contentObjects().filter((item) => item !== object);
      this.selectObjects(selected);
    }
    this.commit();
  }

  toggleLocked(id: string) {
    const object = this.findById(id);
    if (!object) return;
    this.applyInteraction(object, object.visible !== false, object.lockMovementX !== true);
    this.commit();
  }

  align(edge: AlignEdge) {
    const objects = this.movableObjects();
    if (objects.length === 0) return;
    const selected = this.contentObjects();
    this.canvas.discardActiveObject();
    for (const object of objects) {
      const delta = alignmentDelta(object.getBoundingRect(), this.artboard, edge);
      object.set({
        left: (object.left ?? 0) + delta.dx,
        top: (object.top ?? 0) + delta.dy,
      });
      object.setCoords();
    }
    this.selectObjects(selected);
    this.commit();
  }

  distribute(axis: "horizontal" | "vertical") {
    const objects = this.movableObjects();
    if (objects.length < 3) return;
    const selected = this.contentObjects();
    const items = objects.map((object) => {
      const bounds = object.getBoundingRect();
      return {
        id: this.data.get(object)?.id ?? "",
        object,
        start: axis === "horizontal" ? bounds.left : bounds.top,
        size: axis === "horizontal" ? bounds.width : bounds.height,
      };
    });
    const deltas = distributionDeltas(items);
    this.canvas.discardActiveObject();
    for (const item of items) {
      const delta = deltas.get(item.id) ?? 0;
      if (axis === "horizontal") item.object.set({ left: (item.object.left ?? 0) + delta });
      else item.object.set({ top: (item.object.top ?? 0) + delta });
      item.object.setCoords();
    }
    this.selectObjects(selected);
    this.commit();
  }

  async undo() {
    if (this.restoring) return;
    this.flushCommit();
    const entry = this.history.undo();
    if (!entry) return;
    await this.restore(entry.document, entry.selection);
  }

  async redo() {
    if (this.restoring) return;
    this.flushCommit();
    const entry = this.history.redo();
    if (!entry) return;
    await this.restore(entry.document, entry.selection);
  }

  private addObject(object: FabricObject, data: LogoObjectData) {
    this.data.set(object, data);
    styleLogoObject(object);
    const step = (this.placed % 6) * 24;
    this.placed += 1;
    // positionByLeftTop works for both left/top and Fabric 7's default center origin.
    object.positionByLeftTop(
      new Point(
        (this.artboard.width - object.getScaledWidth()) / 2 + step - 48,
        (this.artboard.height - object.getScaledHeight()) / 2 + step - 48,
      ),
    );
    object.setCoords();
    this.applyInteraction(object, true, false);
    this.canvas.add(object);
    this.canvas.sendObjectToBack(this.artboard);
    const previousIds = this.selectionIds();
    this.canvas.setActiveObject(object);
    this.history.setSelection(previousIds);
    this.commit();
  }

  private resize(host: HTMLElement) {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 2 || height < 2) return;
    this.canvas.setDimensions({ width, height });
    if (!this.ready) {
      if (!this.openStarted) {
        this.openStarted = true;
        void this.finishOpen();
      }
      return;
    }
    if (!this.userAdjustedZoom) this.fit();
    else this.canvas.requestRenderAll();
  }

  private async finishOpen() {
    this.suppressRevision = true;
    let collapsedToExact = false;
    try {
      if (this.initialDocument) {
        const preferred = preferExactUpload(this.initialDocument);
        collapsedToExact = preferred !== this.initialDocument;
        this.reconstruction = preferred.reconstruction ?? null;
        await this.restore(JSON.stringify(sceneFromProject(preferred)), []);
        await this.waitForDocumentFonts();
      }
      this.history.reset(this.serialize());
      this.ready = true;
      this.resize(this.host);
      if (this.openTool === "pen") await this.setTool("pen");
    } catch {
      this.error = "The project could not be opened.";
      this.ready = true;
      this.emit();
    } finally {
      this.suppressRevision = false;
    }
    // Persist the exact logo so the next open never brings back broken traced layers.
    if (collapsedToExact) {
      this.revision += 1;
      this.emit();
    }
  }

  private async waitForDocumentFonts() {
    const loads: Promise<unknown>[] = [];
    for (const object of this.stack()) {
      if (!(object instanceof IText)) continue;
      const family = String(object.fontFamily ?? "")
        .split(",")[0]
        ?.trim()
        .replaceAll('"', "");
      if (!family) continue;
      loads.push(document.fonts.load(`${object.fontWeight ?? 500} ${object.fontSize ?? 72}px "${family}"`));
    }
    await Promise.all(loads);
    await document.fonts.ready;
    for (const object of this.stack()) {
      if (!(object instanceof IText)) continue;
      object.initDimensions();
      object.set({ dirty: true });
      object.setCoords();
    }
  }

  private contentObjects() {
    return this.canvas.getActiveObjects().filter((object) => this.data.has(object));
  }

  private singleSelection() {
    const objects = this.contentObjects();
    return objects.length === 1 ? objects[0] : null;
  }

  private nextName(_type: LogoObjectType, label: string) {
    const count = (this.counts.get(label) ?? 0) + 1;
    this.counts.set(label, count);
    return count === 1 ? label : `${label} ${count}`;
  }

  private paintFont(object: IText) {
    const primary = String(object.fontFamily ?? "")
      .split(",")[0]
      ?.trim()
      .replaceAll('"', "");
    if (!primary) return;
    const weight = object.fontWeight ?? 500;
    const size = object.fontSize ?? 72;
    void document.fonts
      .load(`${weight} ${size}px "${primary}"`)
      .then(() => {
        if (this.canvas.destroyed) return;
        if (object.path) object.setPathInfo();
        object.initDimensions();
        object.set({ dirty: true });
        object.setCoords();
        this.canvas.requestRenderAll();
        this.emit();
      })
      .catch(() => {
        if (!this.canvas.destroyed) this.canvas.requestRenderAll();
      });
  }

  private canvasFamily(fontId: string) {
    return (
      this.fonts.find((font) => font.id === fontId)?.canvasFamily ??
      this.fonts[0]?.canvasFamily ??
      "sans-serif"
    );
  }

  private applyFill(object: FabricObject, fill: string | null) {
    if (this.data.get(object)?.type === "line") return;
    const value = fill ?? "transparent";
    const leaves = this.leaves(object);
    if (leaves.length > 0) {
      for (const leaf of leaves) leaf.set("fill", value);
      return;
    }
    object.set("fill", value);
  }

  /** Cache the natural clipped bitmap once so Fill can be changed repeatedly. */
  private cacheImagePieceBase(object: FabricImage) {
    if (this.imagePieceBases.has(object)) return;
    const element = object.getElement();
    const width = Math.max(1, Math.round(object.width || ("width" in element ? Number(element.width) : 1)));
    const height = Math.max(1, Math.round(object.height || ("height" in element ? Number(element.height) : 1)));
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const context = surface.getContext("2d");
    if (!context) return;
    context.drawImage(element, 0, 0, width, height);
    this.imagePieceBases.set(object, surface);
  }

  /** Average opaque pixel color from the untinted piece bitmap (for the Style swatch). */
  private sampleImagePieceColor(object: FabricImage): string | null {
    this.cacheImagePieceBase(object);
    const base = this.imagePieceBases.get(object);
    if (!base) return null;
    const context = base.getContext("2d");
    if (!context) return null;
    const { data } = context.getImageData(0, 0, base.width, base.height);
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let weight = 0;
    // Stride keeps this cheap on large slices; alpha-weighted so soft edges count less.
    const stride = Math.max(1, Math.floor((base.width * base.height) / 4000)) * 4;
    for (let index = 0; index < data.length; index += stride) {
      const alpha = data[index + 3];
      if (alpha < 32) continue;
      const a = alpha / 255;
      totalR += data[index] * a;
      totalG += data[index + 1] * a;
      totalB += data[index + 2] * a;
      weight += a;
    }
    if (weight < 0.5) return null;
    const toHex = (channel: number) =>
      Math.round(channel / weight)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(totalR)}${toHex(totalG)}${toHex(totalB)}`;
  }

  /** Solid recolor of a clipped upload piece — keeps alpha, replaces RGB. */
  private applyImagePieceFill(object: FabricImage, fill: string | null) {
    this.cacheImagePieceBase(object);
    const base = this.imagePieceBases.get(object);
    if (!base) return;
    const surface = document.createElement("canvas");
    surface.width = base.width;
    surface.height = base.height;
    const context = surface.getContext("2d");
    if (!context) return;
    context.drawImage(base, 0, 0);
    const color = fill ? hexToRgb(fill) : null;
    if (color) {
      const imageData = context.getImageData(0, 0, surface.width, surface.height);
      const pixels = imageData.data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0) continue;
        pixels[index] = color.r;
        pixels[index + 1] = color.g;
        pixels[index + 2] = color.b;
      }
      context.putImageData(imageData, 0, 0);
    }
    object.setElement(surface);
    // Empty string — not Fabric's rgb(0,0,0) default — so serialize does not fake a tint.
    object.set({ fill: fill ?? "" });
    object.setCoords();
  }

  private applyStroke(object: FabricObject, stroke: string | null) {
    const targets = this.leaves(object);
    const objects = targets.length > 0 ? targets : [object];
    for (const target of objects) {
      target.set("stroke", stroke);
      if (stroke && (target.strokeWidth ?? 0) === 0) target.set("strokeWidth", 4);
    }
  }

  private applyStrokeWidth(object: FabricObject, strokeWidth: number) {
    const targets = this.leaves(object);
    const objects = targets.length > 0 ? targets : [object];
    for (const target of objects) target.set("strokeWidth", strokeWidth);
  }

  private leaves(object: FabricObject) {
    const children = objectChildren(object);
    if (children.length === 0) return [];
    const leaves: FabricObject[] = [];
    const visit = (node: FabricObject) => {
      const nested = objectChildren(node);
      if (nested.length === 0) {
        leaves.push(node);
        return;
      }
      for (const child of nested) visit(child);
    };
    for (const child of children) visit(child);
    return leaves;
  }

  private createSnapshot(): EditorSnapshot {
    const selected = this.contentObjects();
    const selectedIds = new Set(this.selectionIds());
    return {
      ready: this.ready,
      zoom: this.canvas.getZoom(),
      artboard: {
        presetId: this.presetId,
        width: Math.round(this.artboard.width || DEFAULT_ARTBOARD.width),
        height: Math.round(this.artboard.height || DEFAULT_ARTBOARD.height),
        background: this.background,
      },
      selection: selected.length === 1 ? this.snapshotOf(selected[0]) : null,
      selectionCount: selected.length,
      layers: [...this.stack()]
        .reverse()
        .filter((object) => {
          const data = this.data.get(object);
          // Hidden reference "Original" stays out of Layers; "Logo" is the editable upload.
          return !(data?.type === "image" && data.name === "Original");
        })
        .map((object) => {
          const data = this.data.get(object);
          return {
            id: data?.id ?? "",
            name: data?.name ?? "Object",
            type: data?.type ?? "rect",
            visible: object.visible !== false,
            locked: object.lockMovementX === true,
            selected: selectedIds.has(data?.id ?? ""),
          };
        }),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      snap: this.snapEnabled,
      tool: this.tool,
      offsetDistance: this.offsetDistance,
      revision: this.revision,
      error: this.error,
      keepShapes: this.reconstruction?.keepShapes === true,
      keepEdgeOutlines: this.reconstruction?.keepEdgeOutlines !== false,
    };
  }

  private snapshotOf(object: FabricObject): SelectionSnapshot {
    const data = this.data.get(object);
    const fillSource = this.leaves(object)[0] ?? object;
    const weight = object instanceof IText ? object.fontWeight : undefined;
    const topLeft = object.getPositionByOrigin("left", "top");
    const isPiece = data?.type === "image" && object instanceof FabricImage && !this.isUploadImage(object);
    return {
      id: data?.id ?? "",
      type: data?.type ?? "rect",
      name: data?.name ?? "Object",
      x: Math.round(topLeft.x),
      y: Math.round(topLeft.y),
      width: Math.max(1, Math.round(object.getScaledWidth())),
      height: Math.max(1, Math.round(object.getScaledHeight())),
      angle: Math.round(object.angle ?? 0),
      opacity: object.opacity ?? 1,
      locked: object.lockMovementX === true,
      fill:
        data?.type === "line"
          ? null
          : data?.type === "image"
            ? hexColor(object.fill)
            : hexColor(fillSource.fill),
      sourceColor: isPiece ? this.sampleImagePieceColor(object) : undefined,
      stroke: hexColor(fillSource.stroke),
      strokeWidth: Math.round(fillSource.strokeWidth ?? 0),
      cornerRadius: object instanceof Rect ? Math.round(object.rx ?? 0) : undefined,
      text: object instanceof IText ? object.text : undefined,
      fontId: data?.fontId,
      fontSize: object instanceof IText ? Math.round(object.fontSize ?? 72) : undefined,
      fontWeight:
        typeof weight === "number" ? weight : weight === "bold" ? 700 : weight ? 400 : undefined,
      onPath: object instanceof IText && Boolean(object.path),
      pathStartOffset:
        object instanceof IText && object.path ? Math.round(object.pathStartOffset ?? 0) : undefined,
    };
  }

  private emit() {
    this.history.setSelection(this.selectionIds());
    const snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private onSelection() {
    if (!this.restoring) this.emit();
  }

  private onModified() {
    if (!this.restoring) this.commit();
  }

  private scheduleCommit() {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => {
      this.commitTimer = 0;
      this.commit();
    }, 400);
  }

  private flushCommit() {
    if (!this.commitTimer) return;
    clearTimeout(this.commitTimer);
    this.commitTimer = 0;
    this.history.push(this.serialize(), this.selectionIds());
  }

  private commit() {
    if (this.restoring) return;
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = 0;
    }
    this.clearGuides();
    this.error = null;
    this.history.push(this.serialize(), this.selectionIds());
    this.revision += 1;
    this.canvas.requestRenderAll();
    this.emit();
  }

  projectDocument() {
    const document = projectFromScene(JSON.parse(this.serialize()) as SceneDocument);
    if (!this.reconstruction) return document;
    return { ...document, reconstruction: this.reconstruction };
  }

  private serialize() {
    const document: SceneDocument = {
      artboard: {
        presetId: this.presetId,
        width: Math.round(this.artboard.width || DEFAULT_ARTBOARD.width),
        height: Math.round(this.artboard.height || DEFAULT_ARTBOARD.height),
        background: this.background,
      },
      objects: this.stack().map((object) => this.recordOf(object)),
    };
    return JSON.stringify(document);
  }

  private recordOf(object: FabricObject): SceneObject {
    const data = this.data.get(object);
    const fillSource = this.leaves(object)[0] ?? object;
    const weight = object instanceof IText ? object.fontWeight : undefined;
    const record: SceneObject = {
      data: {
        id: data?.id ?? createObjectId(),
        type: data?.type ?? "rect",
        name: data?.name ?? "Object",
        ...(data?.iconId ? { iconId: data.iconId } : {}),
        ...(data?.fontId ? { fontId: data.fontId } : {}),
        ...(data?.assetId ? { assetId: data.assetId } : {}),
        ...(data?.confidence !== undefined ? { confidence: data.confidence } : {}),
        ...(data?.clipPath ? { clipPath: data.clipPath } : {}),
        ...(data?.clipRule ? { clipRule: data.clipRule } : {}),
        ...(data?.clipInvert ? { clipInvert: true } : {}),
        ...(data?.clipSubtract ? { clipSubtract: data.clipSubtract } : {}),
      },
      visible: object.visible !== false,
      locked: object.lockMovementX === true,
      left: round(object.left ?? 0),
      top: round(object.top ?? 0),
      scaleX: round(object.scaleX ?? 1),
      scaleY: round(object.scaleY ?? 1),
      angle: round(object.angle ?? 0),
      opacity: round(object.opacity ?? 1),
      fill:
        data?.type === "line"
          ? null
          : data?.type === "image"
            ? hexColor(object.fill)
            : hexColor(fillSource.fill),
      stroke: hexColor(fillSource.stroke),
      strokeWidth: round(fillSource.strokeWidth ?? 0),
      flipX: object.flipX === true,
      flipY: object.flipY === true,
    };
    if (object instanceof IText) {
      record.text = object.text ?? "";
      record.fontFamily = String(object.fontFamily ?? "")
        .split(",")[0]
        ?.trim()
        .replaceAll('"', "");
      record.fontSize = round(object.fontSize ?? 72);
      record.fontWeight = typeof weight === "number" ? weight : weight === "bold" ? 700 : 400;
      record.letterSpacing = round(object.charSpacing ?? 0);
      record.lineHeight = round(object.lineHeight ?? 1.16);
      record.textAlign = object.textAlign === "center" || object.textAlign === "right" ? object.textAlign : "left";
      if (object.path) {
        record.textPath = object.path.path.map((segment) => segment.join(" ")).join(" ");
        record.pathStartOffset = round(object.pathStartOffset ?? 0);
        record.pathSide = object.pathSide === "right" ? "right" : "left";
      }
    }
    if (data?.type === "rect" && object instanceof Rect) {
      record.width = round(object.width ?? 1);
      record.height = round(object.height ?? 1);
      record.corner = round(object.rx ?? 0);
    }
    if (object instanceof Ellipse) {
      record.rx = round(object.rx ?? 1);
      record.ry = round(object.ry ?? 1);
    }
    if (data?.type === "arc" && object instanceof Circle) {
      record.radius = round(object.radius ?? 1);
      record.startAngle = round(object.startAngle ?? 0);
      record.endAngle = round(object.endAngle ?? 360);
    }
    if (object instanceof Polygon) {
      record.points = object.points.map((point) => ({ x: round(point.x), y: round(point.y) }));
    }
    if (data?.type === "image") {
      record.width = round(object.width ?? 1);
      record.height = round(object.height ?? 1);
      // Persist top-left even if a FabricImage still carries center origin.
      const topLeft = object.getPositionByOrigin("left", "top");
      record.left = round(topLeft.x);
      record.top = round(topLeft.y);
      if (data.clipPath) {
        record.path = data.clipPath;
        record.fillRule = data.clipRule === "evenodd" ? "evenodd" : "nonzero";
      }
    }
    if (object instanceof Line) {
      record.x1 = round(object.x1);
      record.y1 = round(object.y1);
      record.x2 = round(object.x2);
      record.y2 = round(object.y2);
    }
    if (data?.type === "path" && object instanceof Path) {
      record.path = object.path.map((segment) => segment.join(" ")).join(" ");
      record.fillRule = object.fillRule === "evenodd" ? "evenodd" : "nonzero";
    }
    return record;
  }

  private async restore(documentJson: string, selection: string[]) {
    this.restoring = true;
    this.clearGuides();
    this.cancelPen();
    try {
      const document = JSON.parse(documentJson) as SceneDocument;
      this.canvas.discardActiveObject();
      for (const object of this.stack()) {
        this.data.delete(object);
        this.canvas.remove(object);
      }
      this.presetId = document.artboard.presetId;
      this.background = document.artboard.background;
      if (document.artboard.background) this.lastSolid = document.artboard.background;
      this.artboard.set({
        width: document.artboard.width,
        height: document.artboard.height,
        scaleX: 1,
        scaleY: 1,
        fill: document.artboard.background ?? "rgba(0,0,0,0)",
      });
      this.artboard.setCoords();
      this.counts.clear();
      const created: FabricObject[] = [];
      for (const record of document.objects) {
        const object = await this.recreate(record);
        if (!object) continue;
        created.push(object);
        const label = record.data.name.replace(/ copy\b/g, "").replace(/ \d+$/, "").trim();
        this.counts.set(label, (this.counts.get(label) ?? 0) + 1);
      }
      this.canvas.sendObjectToBack(this.artboard);
      this.normalizeReconstructionVisibility();
      const selected = created.filter((object) => selection.includes(this.data.get(object)?.id ?? ""));
      this.selectObjects(selected);
    } finally {
      this.restoring = false;
    }
    if (!this.suppressRevision) this.revision += 1;
    this.canvas.requestRenderAll();
    this.emit();
  }

  private async recreate(record: SceneObject) {
    const data = record.data;
    let object: FabricObject;
    if (data.type === "text") {
      const fontId =
        data.fontId ??
        this.fonts.find((font) => font.canvasFamily === record.fontFamily)?.id ??
        DEFAULT_FONT_ID;
      data.fontId = fontId;
      object = createTextObject({
        id: data.id,
        name: data.name,
        canvasFamily: this.canvasFamily(fontId),
        fontId,
      }).object;
      if (object instanceof IText) {
        object.set({
          text: record.text ?? "Logo",
          fontSize: record.fontSize ?? 72,
          fontWeight: record.fontWeight ?? 500,
          charSpacing: record.letterSpacing ?? 0,
          lineHeight: record.lineHeight ?? 1.16,
          textAlign: record.textAlign ?? "left",
        });
        if (record.textPath) this.attachStoredPath(object, record);
        this.paintFont(object);
      }
    } else if (data.type === "rect") {
      object = createRectObject({ id: data.id, name: data.name }).object;
      object.set({
        width: record.width ?? object.width,
        height: record.height ?? object.height,
        rx: record.corner ?? 0,
        ry: record.corner ?? 0,
      });
    } else if (data.type === "ellipse") {
      object = createEllipseObject({ id: data.id, name: data.name }).object;
      if (object instanceof Ellipse) object.set({ rx: record.rx ?? object.rx, ry: record.ry ?? object.ry });
    } else if (data.type === "polygon") {
      const points = record.points ?? [];
      if (points.length < 3) return null;
      object = new Polygon(points, {
        originX: "left",
        originY: "top",
        strokeUniform: true,
      });
    } else if (data.type === "arc") {
      object = createArcObject({ id: data.id, name: data.name }).object;
      if (object instanceof Circle) {
        object.set({
          radius: record.radius ?? object.radius,
          startAngle: record.startAngle ?? object.startAngle,
          endAngle: record.endAngle ?? object.endAngle,
        });
      }
    } else if (data.type === "path") {
      if (!record.path) return null;
      object = new Path(record.path, {
        originX: "left",
        originY: "top",
        left: record.left,
        top: record.top,
        fillRule: record.fillRule ?? "nonzero",
        strokeUniform: true,
      });
    } else if (data.type === "image") {
      const clip = record.path ?? data.clipPath;
      const clipRule = record.fillRule ?? data.clipRule ?? "nonzero";
      const clipInvert = data.clipInvert === true;
      // Place uses the scene left/top (keeps user moves). Crop always follows the path in upload space.
      const placeX = record.left ?? 0;
      const placeY = record.top ?? 0;
      let pieceWidth = Math.max(1, record.width && record.width > 0 ? record.width : 200);
      let pieceHeight = Math.max(1, record.height && record.height > 0 ? record.height : 200);
      let cropX = placeX;
      let cropY = placeY;
      if (clip && data.name !== "Logo") {
        const box = pathBounds(clip);
        if (box) {
          cropX = box.x;
          cropY = box.y;
          pieceWidth = Math.max(1, box.width);
          pieceHeight = Math.max(1, box.height);
          record.width = pieceWidth;
          record.height = pieceHeight;
        }
      }
      record.left = placeX;
      record.top = placeY;
      const fullWidth = Math.max(pieceWidth, this.artboard.width || pieceWidth);
      const fullHeight = Math.max(pieceHeight, this.artboard.height || pieceHeight);
      const clipSubtract = data.clipSubtract;
      // Keep: transparent holes (clean move, rings may show). Remove: punch + fill round shape
      // holes with the artboard color so moving a circle leaves no dark void. Never expand/fill
      // word-band punches — that frays live text (VOLT, etc.) and no longer matches the upload.
      const hidePunches =
        data.name === "Logo" && this.reconstruction?.keepEdgeOutlines === false;
      const loaded =
        data.assetId && clip
          ? await this.loadClippedUpload({
              assetId: data.assetId,
              pathD: clip,
              fillRule: clipRule === "evenodd" ? "evenodd" : "nonzero",
              fullWidth,
              fullHeight,
              pieceX: cropX,
              pieceY: cropY,
              pieceWidth,
              pieceHeight,
              invert: clipInvert,
              subtractPath: clipSubtract,
              expandSubtractPx: hidePunches ? 22 : 0,
              expandOnlyRoundHoles: true,
              fillSubtractWith: hidePunches ? this.background || "#111122" : undefined,
              expandClipPx: 0,
            })
          : data.assetId
            ? await this.loadUploadedImage(data.assetId)
            : null;
      if (loaded) {
        object = loaded;
        // Transparent pixels must not steal clicks from pieces underneath.
        // Clear Fabric Image's default rgb(0,0,0) fill so it is not saved as a fake recolor.
        object.set({ perPixelTargetFind: true, fill: "" });
        if (clip) {
          data.clipPath = clip;
          data.clipRule = clipRule === "evenodd" ? "evenodd" : "nonzero";
          if (clipInvert) data.clipInvert = true;
          if (clipSubtract) data.clipSubtract = clipSubtract;
        }
      } else {
        object = createRectObject({ id: data.id, name: data.name }).object;
        object.set({
          width: record.width || 200,
          height: record.height || 200,
          fill: "rgba(0,0,0,0)",
        });
      }
    } else if (data.type === "line") {
      object = new Line([record.x1 ?? 0, record.y1 ?? 0, record.x2 ?? 280, record.y2 ?? 0], {
        originX: "left",
        originY: "center",
        stroke: record.stroke ?? "#171717",
        strokeWidth: record.strokeWidth ?? 12,
        strokeLineCap: "round",
        strokeUniform: true,
        fill: "transparent",
      });
    } else {
      const icon = data.iconId ? findLogoIcon(data.iconId) : undefined;
      if (!icon) return null;
      object = (await createIconObject({ id: data.id, icon })).object;
    }
    object.set({
      left: record.left,
      top: record.top,
      scaleX: record.scaleX,
      scaleY: record.scaleY,
      angle: record.angle,
      opacity: record.opacity,
      flipX: record.flipX === true,
      flipY: record.flipY === true,
    });
    if (data.type === "image" && object.width && object.height) {
      // Project stores natural size + scale as top-left scene coords. FabricImage defaults to
      // center/center, so left/top 0 parks the midpoint on the artboard corner (half-offset).
      const naturalWidth = object.width || 1;
      const naturalHeight = object.height || 1;
      const targetWidth = Math.max(1, (record.width && record.width > 0 ? record.width : naturalWidth) * record.scaleX);
      const targetHeight = Math.max(1, (record.height && record.height > 0 ? record.height : naturalHeight) * record.scaleY);
      object.set({
        originX: "left",
        originY: "top",
        scaleX: targetWidth / naturalWidth,
        scaleY: targetHeight / naturalHeight,
      });
      // Must run after scale — uses transformed size to pin the bitmap's top-left to the artboard.
      object.positionByLeftTop(
        new Point((this.artboard.left ?? 0) + (record.left ?? 0), (this.artboard.top ?? 0) + (record.top ?? 0)),
      );
    }
    if (data.type === "icon" && object.width && object.height) {
      const width = record.width && record.width > 0 ? record.width : object.width;
      const height = record.height && record.height > 0 ? record.height : object.height;
      object.set({
        scaleX: (width * record.scaleX) / object.width,
        scaleY: (height * record.scaleY) / object.height,
      });
    }
    this.data.set(object, { ...data });
    styleLogoObject(object);
    if (data.type === "image" && object instanceof FabricImage && !this.isUploadImage(object)) {
      this.cacheImagePieceBase(object);
      if (record.fill) this.applyImagePieceFill(object, record.fill);
    } else if (data.type !== "line" && data.type !== "image") {
      this.applyFill(object, record.fill);
    }
    if (data.type !== "image") {
      this.applyStroke(object, record.stroke);
      this.applyStrokeWidth(object, record.strokeWidth);
    }
    this.applyInteraction(object, record.visible, record.locked);
    object.setCoords();
    this.canvas.add(object);
    return object;
  }

  private snap(target: FabricObject | undefined) {
    if (!this.snapEnabled || this.restoring || !target || !this.data.has(target)) return;
    if (target.lockMovementX) return;
    const threshold = 6 / this.canvas.getZoom();
    target.setCoords();
    const bounds = target.getBoundingRect();
    const xPoints = [bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width];
    const yPoints = [bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height];
    const xTargets = [0, this.artboard.width / 2, this.artboard.width];
    const yTargets = [0, this.artboard.height / 2, this.artboard.height];
    for (const other of this.stack()) {
      if (other === target || other.visible === false) continue;
      const otherBounds = other.getBoundingRect();
      xTargets.push(otherBounds.left, otherBounds.left + otherBounds.width / 2, otherBounds.left + otherBounds.width);
      yTargets.push(otherBounds.top, otherBounds.top + otherBounds.height / 2, otherBounds.top + otherBounds.height);
    }
    const xSnap = nearest(xPoints, xTargets, threshold);
    const ySnap = nearest(yPoints, yTargets, threshold);
    if (xSnap) target.set({ left: (target.left ?? 0) + xSnap.delta });
    if (ySnap) target.set({ top: (target.top ?? 0) + ySnap.delta });
    target.setCoords();
    this.drawGuides(xSnap?.guide ?? null, ySnap?.guide ?? null);
  }

  private drawGuides(x: number | null, y: number | null) {
    this.clearGuides();
    if (x !== null) this.guides.push(this.guideLine([x, 0, x, this.artboard.height]));
    if (y !== null) this.guides.push(this.guideLine([0, y, this.artboard.width, y]));
    if (this.guides.length > 0) {
      this.canvas.add(...this.guides);
      this.canvas.requestRenderAll();
    }
  }

  private guideLine(points: [number, number, number, number]) {
    return new Line(points, {
      stroke: "#2f6fed",
      strokeWidth: 1,
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
  }

  private clearGuides() {
    if (this.guides.length === 0) return;
    this.canvas.remove(...this.guides);
    this.guides.length = 0;
    this.canvas.requestRenderAll();
  }

  private stack() {
    return this.canvas.getObjects().filter((object) => this.data.has(object));
  }

  private findById(id: string) {
    return this.stack().find((object) => this.data.get(object)?.id === id);
  }

  private selectionIds() {
    return this.contentObjects().map((object) => this.data.get(object)?.id ?? "");
  }

  private movableObjects() {
    return this.contentObjects().filter(
      (object) => object.lockMovementX !== true && object.visible !== false,
    );
  }

  private selectObjects(objects: FabricObject[]) {
    if (objects.length === 0) this.canvas.discardActiveObject();
    else if (objects.length === 1) this.canvas.setActiveObject(objects[0]);
    else this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }));
  }

  private applyInteraction(object: FabricObject, visible: boolean, locked: boolean) {
    object.set({
      visible,
      // Locked layers (like Original) can stay visible for reference without blocking the pen.
      evented: visible && !locked,
      selectable: visible && !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: visible && !locked,
    });
    if (object instanceof IText) object.editable = visible && !locked;
  }

  private isUploadImage(object: FabricObject) {
    const data = this.data.get(object);
    return data?.type === "image" && (data.name === "Original" || data.name === "Logo");
  }

  private normalizeReconstructionVisibility() {
    // Exact upload is preferred in preferExactUpload() on open. If an old session still has
    // traced shapes beside the bitmap, hide the traces so the eye cannot stack a second mark.
    // keepShapes / clipped pieces must stay visible and selectable — never mass-hide them.
    if (!this.reconstruction || this.reconstruction.keepShapes) return;
    const upload = this.stack().find((object) => this.isUploadImage(object));
    if (!upload) return;
    this.applyInteraction(upload, true, false);
    const data = this.data.get(upload);
    if (data) this.data.set(upload, { ...data, name: "Logo" });
    for (const object of this.stack()) {
      if (object === upload) continue;
      if (object.visible !== false) this.applyInteraction(object, false, object.lockMovementX === true);
    }
  }

  private nudge(dx: number, dy: number) {
    const selected = this.contentObjects();
    const movable = selected.filter((object) => object.lockMovementX !== true);
    if (movable.length === 0) return;
    this.canvas.discardActiveObject();
    for (const object of movable) {
      object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy });
      object.setCoords();
    }
    this.selectObjects(selected);
    this.commit();
  }

  private emitSoon() {
    if (this.emitFrame) return;
    this.emitFrame = requestAnimationFrame(() => {
      this.emitFrame = 0;
      this.emit();
    });
  }

  private async loadUploadedImage(assetId: string) {
    try {
      const { getGuestAssetUrl } = await import("@/features/editor/guest-assets");
      const guestUrl = getGuestAssetUrl(assetId);
      if (guestUrl) {
        // Guest registry owns this URL — do not revoke it when the canvas remounts.
        return await FabricImage.fromURL(guestUrl, {}, { originX: "left", originY: "top" });
      }
      const response = await fetch(`/api/uploads/${assetId}`, { credentials: "same-origin" });
      if (!response.ok) return null;
      const url = URL.createObjectURL(await response.blob());
      this.imageUrls.add(url);
      return await FabricImage.fromURL(url, {}, { originX: "left", originY: "top" });
    } catch {
      return null;
    }
  }

  /** Exact upload pixels, cropped to one traced region; child paths are punched out to prevent ghosts. */
  private async loadClippedUpload(input: {
    assetId: string;
    pathD: string;
    fillRule: "evenodd" | "nonzero";
    fullWidth: number;
    fullHeight: number;
    pieceX: number;
    pieceY: number;
    pieceWidth: number;
    pieceHeight: number;
    invert?: boolean;
    subtractPath?: string;
    /** Grow destination-out holes by this many px (Logo plate). */
    expandSubtractPx?: number;
    /** When set with expandSubtractPx, only stroke round-ish hole subpaths (not letters). */
    expandOnlyRoundHoles?: boolean;
    /** After punching, paint this color into the holes (hides dark voids on opaque artboards). */
    fillSubtractWith?: string;
    /** Grow destination-in clip by this many px so rings stay on the movable slice. */
    expandClipPx?: number;
  }) {
    try {
      const { getGuestAsset } = await import("@/features/editor/guest-assets");
      const guest = getGuestAsset(input.assetId);
      const blob = guest
        ? guest.blob
        : await (async () => {
            const response = await fetch(`/api/uploads/${input.assetId}`, { credentials: "same-origin" });
            if (!response.ok) return null;
            return response.blob();
          })();
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const fullWidth = Math.max(1, Math.round(input.fullWidth));
      const fullHeight = Math.max(1, Math.round(input.fullHeight));
      const pieceWidth = Math.max(1, Math.round(input.pieceWidth));
      const pieceHeight = Math.max(1, Math.round(input.pieceHeight));
      const surface = document.createElement("canvas");
      surface.width = pieceWidth;
      surface.height = pieceHeight;
      const context = surface.getContext("2d");
      if (!context) {
        bitmap.close();
        return null;
      }
      // Path coords are artboard-absolute; shift so this piece's top-left is (0,0) on the crop.
      context.translate(-input.pieceX, -input.pieceY);
      // Draw the upload as it fills the artboard — same space the tracer paths were built in.
      context.drawImage(bitmap, 0, 0, fullWidth, fullHeight);
      bitmap.close();
      const rule = input.fillRule === "evenodd" ? "evenodd" : "nonzero";
      context.fillStyle = "#000";
      // Full-board Logo passes a rect path only to enable subtract; skip destination-in when the
      // path already covers the whole piece (avoids an extra AA pass that frays edges).
      const coversPiece = pathCoversPiece(input.pathD, input.pieceX, input.pieceY, pieceWidth, pieceHeight);
      if (!coversPiece) {
        context.globalCompositeOperation = input.invert ? "destination-out" : "destination-in";
        const clipPath = new Path2D(input.pathD);
        context.fill(clipPath, rule);
        const expandClip = input.expandClipPx ?? 0;
        if (expandClip > 0 && !input.invert) {
          context.lineWidth = expandClip * 2;
          context.lineJoin = "round";
          context.lineCap = "round";
          context.strokeStyle = "#000";
          context.stroke(clipPath);
        }
      } else if (input.invert) {
        context.globalCompositeOperation = "destination-out";
        context.fill(new Path2D(input.pathD), rule);
      }
      // Punch child regions out of parents so moving a circle/letter leaves a hole, not a copy.
      if (input.subtractPath && !input.invert) {
        context.globalCompositeOperation = "destination-out";
        const hole = new Path2D(input.subtractPath);
        context.fill(hole, "nonzero");
        const expand = input.expandSubtractPx ?? 0;
        const roundOnly = input.expandOnlyRoundHoles === true;
        const roundSubs = roundOnly
          ? splitSubpaths(input.subtractPath).filter((sub) => {
              const box = pathBounds(sub);
              return Boolean(box && isRoundClipPath(sub, box.width, box.height));
            })
          : [];
        if (expand > 0) {
          context.lineWidth = expand * 2;
          context.lineJoin = "round";
          context.lineCap = "round";
          context.strokeStyle = "#000";
          if (roundOnly) {
            for (const sub of roundSubs) context.stroke(new Path2D(sub));
          } else {
            context.stroke(hole);
          }
        }
        // Paint plate-matching color into holes so Remove does not leave visible dark punches.
        // With roundOnly, only fill/expand circular mark holes — leave word-band punches alone
        // so live text stays identical to the original upload.
        if (input.fillSubtractWith) {
          let fill = input.fillSubtractWith;
          const sx = Math.min(8, Math.max(0, pieceWidth - 1));
          const sy = Math.min(8, Math.max(0, pieceHeight - 1));
          const sample = context.getImageData(sx, sy, 1, 1).data;
          if (sample[3] > 200) fill = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
          context.globalCompositeOperation = "destination-over";
          context.fillStyle = fill;
          if (roundOnly) {
            for (const sub of roundSubs) {
              const path = new Path2D(sub);
              context.fill(path, "nonzero");
              if (expand > 0) {
                context.lineWidth = expand * 2;
                context.lineJoin = "round";
                context.lineCap = "round";
                context.strokeStyle = fill;
                context.stroke(path);
              }
            }
          } else {
            context.fill(hole, "nonzero");
            if (expand > 0) {
              context.lineWidth = expand * 2;
              context.lineJoin = "round";
              context.lineCap = "round";
              context.strokeStyle = fill;
              context.stroke(hole);
            }
          }
        }
      }
      const url = surface.toDataURL("image/png");
      return await FabricImage.fromURL(url, {}, { originX: "left", originY: "top" });
    } catch {
      return null;
    }
  }

  /** Keep: transparent holes (clean move). Remove: punch + fill with artboard color (no dark voids). */
  async setKeepEdgeOutlines(keep: boolean) {
    if (!this.reconstruction?.keepShapes) return;
    if ((this.reconstruction.keepEdgeOutlines !== false) === keep) return;
    this.reconstruction = { ...this.reconstruction, keepEdgeOutlines: keep };
    const selection = this.selectionIds();
    this.suppressRevision = true;
    try {
      const scene = JSON.parse(this.serialize()) as SceneDocument;
      const logo = scene.objects.find((object) => object.data.name === "Logo" && object.data.type === "image");
      if (logo && !logo.data.clipSubtract) {
        const holes = scene.objects
          .filter((object) => object.data.name !== "Logo" && object.path)
          .map((object) => object.path!)
          .join(" ");
        if (holes) logo.data.clipSubtract = holes;
      }
      await this.restore(JSON.stringify(scene), selection);
    } finally {
      this.suppressRevision = false;
    }
    this.commit();
  }

  private fail(message: string) {
    this.error = message;
    this.canvas.requestRenderAll();
    this.emit();
  }

  private replaceWithOutline(object: FabricObject) {
    const data = this.data.get(object);
    if (!data) throw new OutlineError("That shape has no points to edit.");
    const outline = outlineOf(object);
    const created = createPathObject({
      id: data.id,
      name: data.name,
      d: outline.d,
      fillRule: outline.fillRule,
    });
    created.object.set({ fill: solidPaint(object), opacity: object.opacity ?? 1, stroke: null, strokeWidth: 0 });
    const index = this.canvas.getObjects().indexOf(object);
    this.data.delete(object);
    this.canvas.remove(object);
    this.placePath(created.object, created.data, index);
    this.canvas.setActiveObject(created.object);
    this.commit();
  }

  private attachStoredPath(object: IText, record: SceneObject) {
    if (!record.textPath) return;
    const path = new Path(record.textPath, {
      visible: false,
      fill: "transparent",
      stroke: null,
      strokeWidth: 0,
    });
    object.set({
      path,
      pathAlign: "center",
      pathSide: record.pathSide === "right" ? "right" : "left",
      textAlign: "center",
      pathStartOffset: record.pathStartOffset ?? 0,
    });
    object.setPathInfo();
    object.initDimensions();
  }

  private async importMarkup(markup: string, label: string, dropBackdrop: boolean) {
    const parsed = await loadSVGFromString(markup);
    const nodes = parsed.objects
      .filter((node): node is FabricObject => node !== null)
      .flatMap((node) => this.flattenImported(node));
    const created: FabricObject[] = [];
    for (const node of nodes) {
      if (node instanceof IText) {
        const family = String(node.fontFamily ?? "")
          .split(",")[0]
          ?.replaceAll('"', "")
          .trim()
          .toLowerCase();
        const match = this.fonts.find((font) => font.canvasFamily.toLowerCase() === family);
        const fontId = match?.id ?? DEFAULT_FONT_ID;
        const text = createTextObject({
          id: createObjectId(),
          name: this.nextName("text", label),
          canvasFamily: this.canvasFamily(fontId),
          fontId,
        });
        const weight = node.fontWeight;
        text.object.set({
          text: node.text || "Logo",
          fontSize: clamp(Math.round(node.fontSize ?? 72), 8, 500),
          fontWeight: typeof weight === "number" ? weight : weight === "bold" ? 700 : 500,
          left: node.left ?? 0,
          top: node.top ?? 0,
          scaleX: node.scaleX ?? 1,
          scaleY: node.scaleY ?? 1,
          angle: node.angle ?? 0,
          opacity: node.opacity ?? 1,
        });
        this.placePath(text.object, text.data, created.length + 1);
        this.applyFill(text.object, hexColor(node.fill) ?? "#171717");
        this.paintFont(text.object);
        created.push(text.object);
        continue;
      }
      let guide;
      try {
        guide = guideOf(node);
      } catch {
        continue;
      }
      if (!guide.d.trim()) continue;
      const path = createPathObject({
        id: createObjectId(),
        name: this.nextName("path", label),
        d: guide.d,
        fillRule: node instanceof Path && node.fillRule === "evenodd" ? "evenodd" : "nonzero",
      });
      const fill = hexColor(node.fill);
      const stroke = hexColor(node.stroke);
      path.object.set({
        fill: fill ?? (stroke ? "transparent" : "#171717"),
        stroke,
        strokeWidth: stroke ? clamp(node.strokeWidth ?? 1, 0, 80) : 0,
        opacity: node.opacity ?? 1,
      });
      this.placePath(path.object, path.data, created.length + 1);
      created.push(path.object);
    }
    if (dropBackdrop && created.length > 1) this.removeBackdrop(created);
    const live = created.filter((object) => this.data.has(object));
    if (live.length === 0) throw new OutlineError("That file has no shapes.");
    if (live.length > 200) {
      for (const object of live) {
        this.data.delete(object);
        this.canvas.remove(object);
      }
      throw new OutlineError("That trace has too many pieces. Try a simpler image.");
    }
    this.fitImported(live);
    this.selectObjects(live);
    this.commit();
  }

  private flattenImported(object: FabricObject): FabricObject[] {
    const children = objectChildren(object);
    if (children.length === 0 || object instanceof IText) return [object];
    return children.flatMap((child) => this.flattenImported(child));
  }

  private removeBackdrop(objects: FabricObject[]) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const object of objects) {
      object.setCoords();
      const bounds = object.getBoundingRect();
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.left + bounds.width);
      bottom = Math.max(bottom, bounds.top + bounds.height);
    }
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const backdrop = objects.filter((object) => {
      const fill = hexColor(object.fill);
      if (!fill) return false;
      const red = Number.parseInt(fill.slice(1, 3), 16);
      const green = Number.parseInt(fill.slice(3, 5), 16);
      const blue = Number.parseInt(fill.slice(5, 7), 16);
      if (red < 245 || green < 245 || blue < 245) return false;
      const bounds = object.getBoundingRect();
      return bounds.width >= width * 0.8 && bounds.height >= height * 0.8;
    });
    if (backdrop.length === 0 || backdrop.length >= objects.length) return;
    for (const object of backdrop) {
      this.data.delete(object);
      this.canvas.remove(object);
    }
  }

  private fitImported(objects: FabricObject[]) {
    if (objects.length === 0) return;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const object of objects) {
      object.setCoords();
      const bounds = object.getBoundingRect();
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.left + bounds.width);
      bottom = Math.max(bottom, bounds.top + bounds.height);
    }
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const scale = Math.min((this.artboard.width * 0.78) / width, (this.artboard.height * 0.78) / height);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    for (const object of objects) {
      object.set({
        left: this.artboard.width / 2 + ((object.left ?? 0) - centerX) * scale,
        top: this.artboard.height / 2 + ((object.top ?? 0) - centerY) * scale,
        scaleX: (object.scaleX ?? 1) * scale,
        scaleY: (object.scaleY ?? 1) * scale,
        strokeWidth: (object.strokeWidth ?? 0) * scale,
      });
      object.setCoords();
    }
  }

  private placePath(object: FabricObject, data: LogoObjectData, index: number) {
    this.data.set(object, data);
    styleLogoObject(object);
    object.setCoords();
    this.applyInteraction(object, true, false);
    this.canvas.add(object);
    this.canvas.moveObjectTo(object, Math.max(1, index));
    this.canvas.sendObjectToBack(this.artboard);
  }

  private selectedPath() {
    const object = this.singleSelection();
    return object instanceof Path ? object : null;
  }

  private pointer(options: { scenePoint: Point; e: Event }) {
    if (options.e instanceof MouseEvent && options.e.button !== 0 && options.e.type !== "mousemove") return null;
    return { x: options.scenePoint.x, y: options.scenePoint.y };
  }

  private onPointerDown(options: { scenePoint: Point; e: Event }) {
    const point = this.pointer(options);
    if (!point || this.tool === "select") return;
    if (this.tool === "pen") {
      const first = this.penPoints[0];
      const closeDistance = 12 / this.canvas.getZoom();
      if (
        first &&
        this.penPoints.length >= 3 &&
        Math.hypot(point.x - first.x, point.y - first.y) <= closeDistance
      ) {
        this.finishPen(true);
        return;
      }
      this.penDown = { ...point, inX: point.x, inY: point.y, outX: point.x, outY: point.y };
      return;
    }
    const anchors = this.nodeAnchors();
    let nearest = -1;
    let best = 10 / this.canvas.getZoom();
    anchors.forEach((anchor, index) => {
      const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
      if (distance <= best) {
        best = distance;
        nearest = index;
      }
    });
    if (nearest >= 0) this.nodeDrag = { ordinal: nearest, lastX: point.x, lastY: point.y, moved: false };
  }

  private onPointerMove(options: { scenePoint: Point; e: Event }) {
    const point = this.pointer(options);
    if (!point) return;
    if (this.tool === "pen") {
      if (!this.penDown && this.penPoints.length === 0) return;
      if (this.penDown) {
        const distance = Math.hypot(point.x - this.penDown.x, point.y - this.penDown.y);
        if (distance > 4 / this.canvas.getZoom()) {
          this.penDown.outX = point.x;
          this.penDown.outY = point.y;
          this.penDown.inX = this.penDown.x * 2 - point.x;
          this.penDown.inY = this.penDown.y * 2 - point.y;
        }
      }
      this.updatePenPreview(point);
      return;
    }
    if (!this.nodeDrag) return;
    const path = this.selectedPath();
    if (!path) return;
    const dx = point.x - this.nodeDrag.lastX;
    const dy = point.y - this.nodeDrag.lastY;
    if (dx === 0 && dy === 0) return;
    if (!this.nodeDrag.moved) bakePath(path);
    const next = moveAnchor(path.path as (string | number)[][], this.nodeDrag.ordinal, dx, dy);
    path._setPath(next as Path["path"], true);
    path.set({ originX: "left", originY: "top", dirty: true });
    path.setCoords();
    this.nodeDrag.lastX = point.x;
    this.nodeDrag.lastY = point.y;
    this.nodeDrag.moved = true;
    this.canvas.requestRenderAll();
  }

  private onPointerUp(options: { scenePoint: Point; e: Event }) {
    if (this.tool === "pen" && this.penDown) {
      if (options.e instanceof MouseEvent && options.e.button !== 0) return;
      this.penPoints.push(this.penDown);
      this.penDown = null;
      this.updatePenPreview(this.pointer(options));
      return;
    }
    if (!this.nodeDrag) return;
    const moved = this.nodeDrag.moved;
    this.nodeDrag = null;
    if (moved) this.commit();
  }

  private onDoubleClick() {
    if (this.tool !== "pen" || this.penPoints.length < 2) return;
    const last = this.penPoints[this.penPoints.length - 1];
    const previous = this.penPoints[this.penPoints.length - 2];
    if (previous && Math.hypot(last.x - previous.x, last.y - previous.y) < 3) this.penPoints.pop();
    this.finishPen(this.penPoints.length >= 3);
  }

  private finishPen(closed: boolean) {
    const points = this.penDown ? [...this.penPoints, this.penDown] : [...this.penPoints];
    this.penDown = null;
    const shouldClose = closed && points.length >= 3;
    this.cancelPen();
    if (points.length < 2) return;
    const created = createPathObject({
      id: createObjectId(),
      name: this.nextName("path", "Path"),
      d: penToSvg(points, shouldClose),
      fillRule: "nonzero",
    });
    if (!shouldClose) created.object.set({ fill: "transparent", stroke: "#171717", strokeWidth: 8 });
    this.placePath(created.object, created.data, this.canvas.getObjects().length);
    this.canvas.discardActiveObject();
    this.commit();
  }

  private cancelPen() {
    this.penPoints = [];
    this.penDown = null;
    if (!this.penPreview) return;
    this.canvas.remove(this.penPreview);
    this.penPreview = null;
    if (!this.canvas.destroyed) this.canvas.requestRenderAll();
  }

  private updatePenPreview(cursor?: { x: number; y: number } | null) {
    const points = [...this.penPoints];
    if (this.penDown) points.push(this.penDown);
    if (cursor && !this.penDown && points.length > 0) {
      points.push({ x: cursor.x, y: cursor.y, inX: cursor.x, inY: cursor.y, outX: cursor.x, outY: cursor.y });
    }
    if (points.length < 2) {
      if (this.penPreview) {
        this.canvas.remove(this.penPreview);
        this.penPreview = null;
      }
      this.canvas.requestRenderAll();
      return;
    }
    const d = penToSvg(points, false);
    if (!this.penPreview) {
      this.penPreview = new Path(d, {
        originX: "left",
        originY: "top",
        fill: "transparent",
        stroke: "#171717",
        strokeWidth: 2,
        strokeUniform: true,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      this.canvas.add(this.penPreview);
    } else {
      this.penPreview._setPath(d, true);
      this.penPreview.set({ dirty: true });
    }
    this.canvas.requestRenderAll();
  }

  private penAnchors() {
    const points = this.penPoints.map((point) => ({ x: point.x, y: point.y }));
    if (this.penDown) points.push({ x: this.penDown.x, y: this.penDown.y });
    return points;
  }

  private nodeAnchors() {
    if (this.tool !== "nodes") return [];
    const path = this.selectedPath();
    return path ? anchorScenePoints(path) : [];
  }

  private drawToolOverlay() {
    const points = this.tool === "nodes" ? this.nodeAnchors() : this.penAnchors();
    if (points.length === 0) return;
    const ctx = this.canvas.getContext();
    const viewport = this.canvas.viewportTransform;
    if (!ctx || !viewport) return;
    ctx.save();
    ctx.transform(viewport[0], viewport[1], viewport[2], viewport[3], viewport[4], viewport[5]);
    const radius = 6 / this.canvas.getZoom();
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#171717";
      ctx.lineWidth = 1.5 / this.canvas.getZoom();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }
    const active = this.canvas.getActiveObject();
    if (active instanceof IText && active.isEditing) return;
    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;
    if (meta && key === "z") {
      event.preventDefault();
      if (event.shiftKey) void this.redo();
      else void this.undo();
      return;
    }
    if (meta && key === "y") {
      event.preventDefault();
      void this.redo();
      return;
    }
    if (meta && key === "d") {
      event.preventDefault();
      void this.duplicate();
      return;
    }
    if (this.tool === "pen") {
      if (event.key === "Escape") {
        this.cancelPen();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.finishPen(true);
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && this.penPoints.length > 0) {
        event.preventDefault();
        this.penPoints.pop();
        this.penDown = null;
        this.updatePenPreview();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete" || event.key.startsWith("Arrow")) return;
    }
    if (this.tool === "nodes" && event.key === "Escape") {
      void this.setTool("select");
      return;
    }
    if (this.nodeDrag) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.contentObjects().length === 0) return;
      event.preventDefault();
      this.deleteSelection();
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") this.nudge(-step, 0);
    else if (event.key === "ArrowRight") this.nudge(step, 0);
    else if (event.key === "ArrowUp") this.nudge(0, -step);
    else if (event.key === "ArrowDown") this.nudge(0, step);
    else return;
    event.preventDefault();
  };
}

function nearest(points: number[], targets: number[], threshold: number) {
  let best: { delta: number; guide: number } | null = null;
  for (const point of points) {
    for (const target of targets) {
      const delta = target - point;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, guide: target };
    }
  }
  return best;
}

/** Split an SVG path into subpaths starting at each M/m command. */
function splitSubpaths(pathD: string) {
  return pathD.split(/(?=M)/i).map((part) => part.trim()).filter(Boolean);
}

/** Heuristic: large circle mark pieces (diamond dots), not letter counters. */
function isRoundClipPath(pathD: string, width: number, height: number) {
  const min = Math.min(width, height);
  const max = Math.max(width, height);
  // Diamond dots are ~100–140px; letter bowls are smaller.
  if (min < 95 || max > 180) return false;
  if (max / Math.max(1, min) > 1.3) return false;
  return /[CcQqAaSs]/.test(pathD);
}

/** True when pathD is an axis-aligned rect covering the piece crop (Logo plate). */
function pathCoversPiece(pathD: string, pieceX: number, pieceY: number, pieceWidth: number, pieceHeight: number) {
  const match = pathD.match(
    /^\s*M\s+([-\d.]+)\s+([-\d.]+)\s+H\s+([-\d.]+)\s+V\s+([-\d.]+)\s+H\s+([-\d.]+)\s+Z\s*$/i,
  );
  if (!match) return false;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  const x3 = Number(match[5]);
  if (![x1, y1, x2, y2, x3].every(Number.isFinite)) return false;
  if (Math.abs(x3 - x1) > 0.5) return false;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  return (
    left <= pieceX + 0.5 &&
    top <= pieceY + 0.5 &&
    right >= pieceX + pieceWidth - 0.5 &&
    bottom >= pieceY + pieceHeight - 0.5
  );
}
