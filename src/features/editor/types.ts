export type LogoObjectType =
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "icon"
  | "image"
  | "polygon"
  | "arc"
  | "path";

export type EditorTool = "select" | "pen" | "nodes";

export type LogoObjectData = {
  id: string;
  type: LogoObjectType;
  name: string;
  iconId?: string;
  fontId?: string;
  assetId?: string;
  confidence?: number;
  /** SVG path used to clip an upload image into an editable piece. */
  clipPath?: string;
  clipRule?: "evenodd" | "nonzero";
  /** Cut the clip path out instead of keeping only that region. */
  clipInvert?: boolean;
  /** Child piece paths punched out of this slice so moving them leaves no ghost. */
  clipSubtract?: string;
};

export type EditorFontOption = {
  id: string;
  label: string;
  category: string;
  canvasFamily: string;
};

export type ArtboardPresetId = "square" | "icon" | "horizontal" | "vertical" | "custom";

export type ArtboardState = {
  presetId: ArtboardPresetId;
  width: number;
  height: number;
  background: string | null;
};

export type SelectionSnapshot = {
  id: string;
  type: LogoObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  fill: string | null;
  /** Sampled opaque color from a clipped image piece (for the Color swatch when untinted). */
  sourceColor?: string | null;
  stroke: string | null;
  strokeWidth: number;
  cornerRadius?: number;
  locked: boolean;
  text?: string;
  fontId?: string;
  fontSize?: number;
  fontWeight?: number;
  onPath?: boolean;
  pathStartOffset?: number;
};

export type LayerSnapshot = {
  id: string;
  name: string;
  type: LogoObjectType;
  visible: boolean;
  locked: boolean;
  selected: boolean;
};

export type SelectionPatch = {
  name?: string;
  text?: string;
  fontId?: string;
  fontSize?: number;
  fontWeight?: number;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  cornerRadius?: number;
  opacity?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  pathStartOffset?: number;
};

export type EditorSnapshot = {
  ready: boolean;
  zoom: number;
  artboard: ArtboardState;
  selection: SelectionSnapshot | null;
  selectionCount: number;
  layers: LayerSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  tool: EditorTool;
  offsetDistance: number;
  revision: number;
  error: string | null;
  /** Edit elements doc: true when traced pieces stay on the artboard. */
  keepShapes: boolean;
  /** Edit elements doc: keep faint rings around punched holes (default true). false expands the punch. */
  keepEdgeOutlines: boolean;
};
