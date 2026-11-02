export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function alignmentDelta(
  bounds: Bounds,
  board: { width: number; height: number },
  edge: AlignEdge,
) {
  switch (edge) {
    case "left":
      return { dx: -bounds.left, dy: 0 };
    case "center":
      return { dx: (board.width - bounds.width) / 2 - bounds.left, dy: 0 };
    case "right":
      return { dx: board.width - bounds.width - bounds.left, dy: 0 };
    case "top":
      return { dx: 0, dy: -bounds.top };
    case "middle":
      return { dx: 0, dy: (board.height - bounds.height) / 2 - bounds.top };
    case "bottom":
      return { dx: 0, dy: board.height - bounds.height - bounds.top };
  }
}

export function distributionDeltas(
  items: { id: string; start: number; size: number }[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  if (items.length < 3) return deltas;
  const sorted = [...items].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.start + last.size - first.start;
  const used = sorted.reduce((sum, item) => sum + item.size, 0);
  const gap = (span - used) / (sorted.length - 1);
  let cursor = first.start;
  for (const item of sorted) {
    deltas.set(item.id, cursor - item.start);
    cursor += item.size + gap;
  }
  return deltas;
}
