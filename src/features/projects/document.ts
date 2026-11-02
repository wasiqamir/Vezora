import { z } from "zod";
import type { SceneDocument, SceneObject } from "@/features/editor/scene";
import type { ArtboardPresetId, LogoObjectType } from "@/features/editor/types";

/**
 * schemaVersion 1 is the format written today.
 * When a later version ships, add a step such as migrateV1ToV2 and run every
 * stored document forward to CURRENT_SCHEMA_VERSION before the editor sees it.
 * Writers only emit the current version. An unknown version is rejected with
 * unsupported_schema. Do not guess missing fields from a future format.
 */
export const CURRENT_SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const paint = hexColor.nullable();
const preset = z.enum(["square", "icon", "horizontal", "vertical", "custom"]);
const objectType = z.enum([
  "text",
  "rect",
  "ellipse",
  "line",
  "icon",
  "image",
  "polygon",
  "arc",
  "path",
]);

const point = z.object({ x: z.number(), y: z.number() });

const projectObjectSchema = z.object({
  id: z.string().min(1).max(80),
  type: objectType,
  name: z.string().min(1).max(80),
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  scaleX: z.number(),
  scaleY: z.number(),
  angle: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  fill: paint.optional(),
  stroke: paint.optional(),
  strokeWidth: z.number().optional(),
  text: z.string().max(500).optional(),
  fontFamily: z.string().max(80).optional(),
  fontId: z.string().max(80).optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().positive().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textPath: z.string().max(20000).optional(),
  pathStartOffset: z.number().optional(),
  pathSide: z.enum(["left", "right"]).optional(),
  corner: z.number().nonnegative().optional(),
  rx: z.number().optional(),
  ry: z.number().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  points: z.array(point).max(500).optional(),
  radius: z.number().optional(),
  startAngle: z.number().optional(),
  endAngle: z.number().optional(),
  path: z.string().max(200000).optional(),
  fillRule: z.enum(["evenodd", "nonzero"]).optional(),
  iconId: z.string().max(80).optional(),
  assetId: z.string().max(80).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export const projectDocumentSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  artboard: z.object({
    preset,
    width: z.number().int().min(256).max(2048),
    height: z.number().int().min(256).max(2048),
    background: paint,
  }),
  objects: z.array(projectObjectSchema).max(400),
  reconstruction: z
    .object({
      jobId: z.string().min(1).max(80),
      sourceAssetId: z.string().min(1).max(80),
      note: z.string().max(240),
    })
    .optional(),
});

export type ProjectObject = z.infer<typeof projectObjectSchema>;
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export class ProjectDocumentError extends Error {
  readonly code: "unsupported_schema" | "validation_failed";

  constructor(code: ProjectDocumentError["code"]) {
    super(code === "unsupported_schema" ? "That project format is not supported." : "That project could not be saved.");
    this.code = code;
  }
}

export function blankProjectDocument(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    artboard: { preset: "square", width: 1000, height: 1000, background: "#ffffff" },
    objects: [],
  };
}

export function migrateDocument(input: unknown): ProjectDocument {
  if (!input || typeof input !== "object") throw new ProjectDocumentError("unsupported_schema");
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version !== CURRENT_SCHEMA_VERSION) throw new ProjectDocumentError("unsupported_schema");
  const parsed = projectDocumentSchema.safeParse(input);
  if (!parsed.success) throw new ProjectDocumentError("validation_failed");
  return parsed.data;
}

export function reassignObjectIds(document: ProjectDocument, nextId: () => string): ProjectDocument {
  return {
    ...document,
    objects: document.objects.map((object) => ({ ...object, id: nextId() })),
  };
}

export function sceneFromProject(document: ProjectDocument): SceneDocument {
  return {
    artboard: {
      presetId: document.artboard.preset,
      width: document.artboard.width,
      height: document.artboard.height,
      background: document.artboard.background,
    },
    objects: document.objects.map(sceneObjectFromProject),
  };
}

export function projectFromScene(scene: SceneDocument): ProjectDocument {
  return migrateDocument({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    artboard: {
      preset: scene.artboard.presetId,
      width: scene.artboard.width,
      height: scene.artboard.height,
      background: scene.artboard.background,
    },
    objects: scene.objects.map(projectObjectFromScene),
  });
}

function sceneObjectFromProject(object: ProjectObject): SceneObject {
  return {
    data: {
      id: object.id,
      type: object.type as LogoObjectType,
      name: object.name,
      ...(object.iconId ? { iconId: object.iconId } : {}),
      ...(object.fontId ? { fontId: object.fontId } : {}),
      ...(object.assetId ? { assetId: object.assetId } : {}),
      ...(object.confidence !== undefined ? { confidence: object.confidence } : {}),
    },
    visible: object.visible,
    locked: object.locked,
    left: object.x,
    top: object.y,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    angle: object.angle,
    opacity: object.opacity,
    fill: object.fill ?? null,
    stroke: object.stroke ?? null,
    strokeWidth: object.strokeWidth ?? 0,
    text: object.text,
    fontFamily: object.fontFamily,
    fontSize: object.fontSize,
    fontWeight: object.fontWeight,
    letterSpacing: object.letterSpacing,
    lineHeight: object.lineHeight,
    textAlign: object.textAlign,
    width: object.width,
    height: object.height,
    rx: object.rx,
    ry: object.ry,
    x1: object.x1,
    y1: object.y1,
    x2: object.x2,
    y2: object.y2,
    corner: object.corner,
    points: object.points,
    radius: object.radius,
    startAngle: object.startAngle,
    endAngle: object.endAngle,
    flipX: object.flipX,
    flipY: object.flipY,
    path: object.path,
    fillRule: object.fillRule,
    textPath: object.textPath,
    pathStartOffset: object.pathStartOffset,
    pathSide: object.pathSide,
  };
}

function projectObjectFromScene(object: SceneObject): ProjectObject {
  const presetWidth = object.width ?? (object.rx !== undefined ? object.rx * 2 : 0);
  const presetHeight = object.height ?? (object.ry !== undefined ? object.ry * 2 : 0);
  return {
    id: object.data.id,
    type: object.data.type,
    name: object.data.name,
    x: object.left,
    y: object.top,
    width: Math.max(0, presetWidth),
    height: Math.max(0, presetHeight),
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    angle: object.angle,
    opacity: object.opacity,
    visible: object.visible,
    locked: object.locked,
    fill: object.fill,
    stroke: object.stroke,
    strokeWidth: object.strokeWidth,
    ...(object.flipX ? { flipX: true } : {}),
    ...(object.flipY ? { flipY: true } : {}),
    ...(object.text !== undefined ? { text: object.text } : {}),
    ...(object.fontFamily ? { fontFamily: object.fontFamily } : {}),
    ...(object.data.fontId ? { fontId: object.data.fontId } : {}),
    ...(object.fontSize !== undefined ? { fontSize: object.fontSize } : {}),
    ...(object.fontWeight !== undefined ? { fontWeight: object.fontWeight } : {}),
    ...(object.letterSpacing !== undefined ? { letterSpacing: object.letterSpacing } : {}),
    ...(object.lineHeight !== undefined ? { lineHeight: object.lineHeight } : {}),
    ...(object.textAlign ? { textAlign: object.textAlign } : {}),
    ...(object.textPath ? { textPath: object.textPath } : {}),
    ...(object.pathStartOffset !== undefined ? { pathStartOffset: object.pathStartOffset } : {}),
    ...(object.pathSide ? { pathSide: object.pathSide } : {}),
    ...(object.corner ? { corner: object.corner } : {}),
    ...(object.rx !== undefined ? { rx: object.rx } : {}),
    ...(object.ry !== undefined ? { ry: object.ry } : {}),
    ...(object.x1 !== undefined ? { x1: object.x1, y1: object.y1, x2: object.x2, y2: object.y2 } : {}),
    ...(object.points ? { points: object.points } : {}),
    ...(object.radius !== undefined ? { radius: object.radius } : {}),
    ...(object.startAngle !== undefined ? { startAngle: object.startAngle, endAngle: object.endAngle } : {}),
    ...(object.path ? { path: object.path } : {}),
    ...(object.fillRule ? { fillRule: object.fillRule } : {}),
    ...(object.data.iconId ? { iconId: object.data.iconId } : {}),
    ...(object.data.assetId ? { assetId: object.data.assetId } : {}),
    ...(object.data.confidence !== undefined
      ? { confidence: Math.max(0, Math.min(100, Math.round(object.data.confidence))) }
      : {}),
  };
}

export function artboardPreset(value: string): ArtboardPresetId {
  if (value === "square" || value === "icon" || value === "horizontal" || value === "vertical" || value === "custom") {
    return value;
  }
  return "custom";
}
