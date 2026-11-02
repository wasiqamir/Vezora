import type { ArtboardState, LogoObjectData } from "@/features/editor/types";
import type { FillRule } from "@/features/editor/path-geometry";

export type SceneObject = {
  data: LogoObjectData;
  visible: boolean;
  locked: boolean;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  corner?: number;
  points?: { x: number; y: number }[];
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  flipX?: boolean;
  flipY?: boolean;
  path?: string;
  fillRule?: FillRule;
  textPath?: string;
  pathStartOffset?: number;
  pathSide?: "left" | "right";
};

export type SceneDocument = {
  artboard: ArtboardState;
  objects: SceneObject[];
};
