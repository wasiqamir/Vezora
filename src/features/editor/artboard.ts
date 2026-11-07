import type { ArtboardPresetId, ArtboardState, EditorSnapshot } from "@/features/editor/types";

export const ARTBOARD_MIN = 256;
export const ARTBOARD_MAX = 2048;

export const ARTBOARD_PRESETS = [
  { id: "square", label: "Square", width: 1000, height: 1000 },
  { id: "icon", label: "Icon", width: 512, height: 512 },
  { id: "horizontal", label: "Horizontal", width: 1600, height: 800 },
  { id: "vertical", label: "Vertical", width: 800, height: 1400 },
] as const satisfies ReadonlyArray<{
  id: Exclude<ArtboardPresetId, "custom">;
  label: string;
  width: number;
  height: number;
}>;

export const DEFAULT_ARTBOARD: ArtboardState = {
  presetId: "square",
  width: 1000,
  height: 1000,
  background: "#ffffff",
};

export const initialEditorSnapshot: EditorSnapshot = {
  ready: false,
  zoom: 1,
  artboard: DEFAULT_ARTBOARD,
  selection: null,
  selectionCount: 0,
  layers: [],
  canUndo: false,
  canRedo: false,
  snap: true,
  tool: "select",
  offsetDistance: 28,
  revision: 0,
  error: null,
  keepShapes: false,
  keepEdgeOutlines: true,
};

export function matchArtboardPreset(width: number, height: number): ArtboardPresetId {
  const match = ARTBOARD_PRESETS.find((preset) => preset.width === width && preset.height === height);
  return match?.id ?? "custom";
}

export function clampArtboardEdge(value: number) {
  return Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, Math.round(value)));
}
