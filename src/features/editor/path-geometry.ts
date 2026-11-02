import { Circle, Ellipse, FabricObject, IText, Line, Path, Point, Polygon, Polyline, Rect, util } from "fabric";

export class OutlineError extends Error {}

export type FillRule = "evenodd" | "nonzero";

export type Outline = {
  d: string;
  fillRule: FillRule;
};

type Pt = { x: number; y: number };
type Seg = (string | number)[];

const KAPPA = 0.5522847498;

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function visibleColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "transparent" || normalized === "none") return null;
  return value;
}

export function solidPaint(object: FabricObject) {
  return visibleColor(object.fill) ?? visibleColor(object.stroke) ?? "#171717";
}

export function strokePaint(object: FabricObject) {
  return visibleColor(object.stroke);
}

function hasFill(object: FabricObject) {
  return visibleColor(object.fill) !== null;
}

function mapper(object: FabricObject) {
  const matrix = object.calcTransformMatrix();
  return (x: number, y: number): Pt => {
    const point = util.transformPoint(new Point(x, y), matrix);
    return { x: point.x, y: point.y };
  };
}

function fmt(point: Pt) {
  return `${round(point.x)} ${round(point.y)}`;
}

function linePath(points: Pt[], closed: boolean) {
  if (points.length === 0) return "";
  const commands = points.map((point, index) => `${index === 0 ? "M" : "L"} ${fmt(point)}`);
  if (closed) commands.push("Z");
  return commands.join(" ");
}

function normal(from: Pt, to: Pt): Pt {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

function offsetClosed(points: Pt[], distance: number): Pt[] {
  const count = points.length;
  return points.map((point, index) => {
    const previous = points[(index - 1 + count) % count];
    const next = points[(index + 1) % count];
    const left = normal(previous, point);
    const right = normal(point, next);
    let x = left.x + right.x;
    let y = left.y + right.y;
    const length = Math.hypot(x, y);
    if (length < 0.25) {
      x = right.x * distance;
      y = right.y * distance;
    } else {
      x = (x / length) * distance;
      y = (y / length) * distance;
    }
    return { x: point.x + x, y: point.y + y };
  });
}

function ribbon(centerline: Pt[], half: number, closed: boolean) {
  if (centerline.length < 2 || half <= 0) return linePath(centerline, closed);
  if (closed) {
    const outer = offsetClosed(centerline, half);
    const inner = offsetClosed(centerline, -half).reverse();
    return `${linePath(outer, true)} ${linePath(inner, true)}`;
  }
  const forward = centerline.map((point, index) => {
    const previous = centerline[Math.max(0, index - 1)];
    const next = centerline[Math.min(centerline.length - 1, index + 1)];
    const direction = normal(previous, next);
    return { x: point.x + direction.x * half, y: point.y + direction.y * half };
  });
  const back = [...centerline].reverse().map((point, index) => {
    const sourceIndex = centerline.length - 1 - index;
    const previous = centerline[Math.max(0, sourceIndex - 1)];
    const next = centerline[Math.min(centerline.length - 1, sourceIndex + 1)];
    const direction = normal(previous, next);
    return { x: point.x - direction.x * half, y: point.y - direction.y * half };
  });
  return linePath([...forward, ...back], true);
}

function ellipseCommands(map: (x: number, y: number) => Pt, rx: number, ry: number) {
  const curves = [
    [rx, ry * KAPPA, rx * KAPPA, ry, 0, ry],
    [-rx * KAPPA, ry, -rx, ry * KAPPA, -rx, 0],
    [-rx, -ry * KAPPA, -rx * KAPPA, -ry, 0, -ry],
    [rx * KAPPA, -ry, rx, -ry * KAPPA, rx, 0],
  ];
  const start = map(rx, 0);
  const commands = [`M ${fmt(start)}`];
  for (const values of curves) {
    const c1 = map(values[0], values[1]);
    const c2 = map(values[2], values[3]);
    const end = map(values[4], values[5]);
    commands.push(`C ${fmt(c1)} ${fmt(c2)} ${fmt(end)}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function roundedRect(object: Rect): string {
  const width = object.width ?? 0;
  const height = object.height ?? 0;
  const rx = Math.min(object.rx ?? 0, width / 2);
  const ry = Math.min(object.ry ?? 0, height / 2);
  const map = mapper(object);
  const left = -width / 2;
  const top = -height / 2;
  const right = width / 2;
  const bottom = height / 2;
  if (rx < 0.5 || ry < 0.5) {
    return linePath(
      [map(left, top), map(right, top), map(right, bottom), map(left, bottom)],
      true,
    );
  }
  const corner = (c1: number[], c2: number[], to: number[]) => {
    const a = map(c1[0], c1[1]);
    const b = map(c2[0], c2[1]);
    const end = map(to[0], to[1]);
    return `C ${fmt(a)} ${fmt(b)} ${fmt(end)}`;
  };
  const start = map(left + rx, top);
  return [
    `M ${fmt(start)}`,
    `L ${fmt(map(right - rx, top))}`,
    corner(
      [right - rx + KAPPA * rx, top],
      [right, top + ry - KAPPA * ry],
      [right, top + ry],
    ),
    `L ${fmt(map(right, bottom - ry))}`,
    corner(
      [right, bottom - ry + KAPPA * ry],
      [right - rx + KAPPA * rx, bottom],
      [right - rx, bottom],
    ),
    `L ${fmt(map(left + rx, bottom))}`,
    corner(
      [left + rx - KAPPA * rx, bottom],
      [left, bottom - ry + KAPPA * ry],
      [left, bottom - ry],
    ),
    `L ${fmt(map(left, top + ry))}`,
    corner(
      [left, top + ry - KAPPA * ry],
      [left + rx - KAPPA * rx, top],
      [left + rx, top],
    ),
    "Z",
  ].join(" ");
}

function sampleEllipse(object: Ellipse, samples: number) {
  const map = mapper(object);
  const rx = object.rx ?? 0;
  const ry = object.ry ?? 0;
  const points: Pt[] = [];
  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    points.push(map(Math.cos(angle) * rx, Math.sin(angle) * ry));
  }
  return points;
}

function strokeHalf(object: FabricObject) {
  const width = object.strokeWidth ?? 0;
  if (width <= 0) return 0;
  if (object.strokeUniform) return width / 2;
  const scale = (Math.abs(object.scaleX || 1) + Math.abs(object.scaleY || 1)) / 2 || 1;
  return (width * scale) / 2;
}

function endpoint(segment: Seg): Pt | null {
  if (segment[0] === "M" || segment[0] === "L") return { x: Number(segment[1]), y: Number(segment[2]) };
  if (segment[0] === "C") return { x: Number(segment[5]), y: Number(segment[6]) };
  if (segment[0] === "Q") return { x: Number(segment[3]), y: Number(segment[4]) };
  return null;
}

function samePoint(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.2;
}

function isDraw(segment: Seg) {
  return segment[0] === "M" || segment[0] === "L" || segment[0] === "C" || segment[0] === "Q";
}

function closesSubpath(path: Seg[], index: number, startIndex: number) {
  const end = endpoint(path[index]);
  const start = endpoint(path[startIndex]);
  if (!end || !start || !samePoint(end, start)) return false;
  for (let cursor = index + 1; cursor < path.length; cursor += 1) {
    if (path[cursor][0] === "M") return false;
    if (path[cursor][0] === "Z") return true;
    if (isDraw(path[cursor])) return false;
  }
  return false;
}

export function anchorIndexes(path: Seg[]) {
  const indexes: number[] = [];
  let start = -1;
  path.forEach((segment, index) => {
    if (segment[0] === "M") {
      start = index;
      indexes.push(index);
      return;
    }
    if (segment[0] === "Z") {
      start = -1;
      return;
    }
    if (!isDraw(segment) || start < 0) return;
    if (!closesSubpath(path, index, start)) indexes.push(index);
  });
  return indexes;
}

function nextDraw(path: Seg[], index: number) {
  for (let cursor = index + 1; cursor < path.length; cursor += 1) {
    if (path[cursor][0] === "Z" || path[cursor][0] === "M") return null;
    if (isDraw(path[cursor])) return path[cursor];
  }
  return null;
}

function shiftEndpointAndIn(segment: Seg, dx: number, dy: number) {
  if (segment[0] === "M" || segment[0] === "L") {
    segment[1] = round(Number(segment[1]) + dx);
    segment[2] = round(Number(segment[2]) + dy);
    return;
  }
  if (segment[0] === "C") {
    segment[3] = round(Number(segment[3]) + dx);
    segment[4] = round(Number(segment[4]) + dy);
    segment[5] = round(Number(segment[5]) + dx);
    segment[6] = round(Number(segment[6]) + dy);
    return;
  }
  if (segment[0] === "Q") {
    segment[3] = round(Number(segment[3]) + dx);
    segment[4] = round(Number(segment[4]) + dy);
  }
}

function shiftOut(segment: Seg, dx: number, dy: number) {
  if (segment[0] !== "C" && segment[0] !== "Q") return;
  segment[1] = round(Number(segment[1]) + dx);
  segment[2] = round(Number(segment[2]) + dy);
}

export function moveAnchor(path: Seg[], ordinal: number, dx: number, dy: number) {
  const copy = path.map((segment) => [...segment]);
  const indexes = anchorIndexes(copy);
  const index = indexes[ordinal];
  const origin = index === undefined ? null : endpoint(copy[index]);
  if (!origin) return copy;
  copy.forEach((segment, segmentIndex) => {
    const end = endpoint(segment);
    if (!end || !samePoint(end, origin)) return;
    shiftEndpointAndIn(segment, dx, dy);
    const following = nextDraw(copy, segmentIndex);
    if (following) shiftOut(following, dx, dy);
  });
  return copy;
}

export function anchorScenePoints(object: Path): Pt[] {
  const matrix = object.calcTransformMatrix();
  const offsetX = object.pathOffset?.x ?? 0;
  const offsetY = object.pathOffset?.y ?? 0;
  return anchorIndexes(object.path as Seg[])
    .map((index) => endpoint((object.path as Seg[])[index]))
    .filter((point): point is Pt => point !== null)
    .map((point) => {
      const scene = util.transformPoint(new Point(point.x - offsetX, point.y - offsetY), matrix);
      return { x: scene.x, y: scene.y };
    });
}

function normalizeCommands(path: Seg[]) {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const commands: Seg[] = [];
  for (const segment of path) {
    if (segment[0] === "Q") {
      const cx = Number(segment[1]);
      const cy = Number(segment[2]);
      const endX = Number(segment[3]);
      const endY = Number(segment[4]);
      commands.push([
        "C",
        round(x + (2 / 3) * (cx - x)),
        round(y + (2 / 3) * (cy - y)),
        round(endX + (2 / 3) * (cx - endX)),
        round(endY + (2 / 3) * (cy - endY)),
        round(endX),
        round(endY),
      ]);
      x = endX;
      y = endY;
      continue;
    }
    commands.push([...segment]);
    const end = endpoint(segment);
    if (segment[0] === "M" && end) {
      startX = end.x;
      startY = end.y;
    }
    if (segment[0] === "Z") {
      x = startX;
      y = startY;
      continue;
    }
    if (end) {
      x = end.x;
      y = end.y;
    }
  }
  return commands;
}

export function bakePath(object: Path) {
  const matrix = object.calcTransformMatrix();
  const offsetX = object.pathOffset?.x ?? 0;
  const offsetY = object.pathOffset?.y ?? 0;
  const baked = normalizeCommands(object.path as Seg[]).map((segment) => {
    const next = [...segment];
    for (let index = 1; index < segment.length - 1; index += 2) {
      const point = util.transformPoint(
        new Point(Number(segment[index]) - offsetX, Number(segment[index + 1]) - offsetY),
        matrix,
      );
      next[index] = round(point.x);
      next[index + 1] = round(point.y);
    }
    return next;
  });
  object.set({
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    skewX: 0,
    skewY: 0,
    originX: "left",
    originY: "top",
  });
  object._setPath(baked as Path["path"], true);
  object.set({ originX: "left", originY: "top", dirty: true });
  object.setCoords();
}

function commandsToSvg(path: Seg[]) {
  return path
    .map((segment) =>
      segment
        .map((part, index) => (index === 0 ? String(part) : String(round(Number(part)))))
        .join(" "),
    )
    .join(" ");
}

function pathOutline(object: Path): Outline {
  const matrix = object.calcTransformMatrix();
  const offsetX = object.pathOffset?.x ?? 0;
  const offsetY = object.pathOffset?.y ?? 0;
  const transformed = normalizeCommands(object.path as Seg[]).map((segment) => {
    const next = [...segment];
    for (let index = 1; index < segment.length - 1; index += 2) {
      const point = util.transformPoint(
        new Point(Number(segment[index]) - offsetX, Number(segment[index + 1]) - offsetY),
        matrix,
      );
      next[index] = point.x;
      next[index + 1] = point.y;
    }
    return next;
  });
  const d = commandsToSvg(transformed);
  if (!d) throw new OutlineError("That shape has no outline.");
  return { d, fillRule: object.fillRule === "evenodd" ? "evenodd" : "nonzero" };
}

function circleOutline(object: Circle): Outline {
  const start = object.startAngle ?? 0;
  const end = object.endAngle ?? 360;
  let sweep = object.counterClockwise ? start - end : end - start;
  sweep = ((sweep % 360) + 360) % 360;
  if (sweep === 0) sweep = 360;
  const radius = object.radius ?? 0;
  const map = mapper(object);
  if (sweep >= 359.5 && hasFill(object)) {
    return { d: ellipseCommands(map, radius, radius), fillRule: "nonzero" };
  }
  const steps = Math.max(12, Math.ceil(sweep / 8));
  const centerline: Pt[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = ((start + (sweep * index) / steps) * Math.PI) / 180;
    centerline.push(map(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  if (hasFill(object)) {
    return { d: linePath([map(0, 0), ...centerline], true), fillRule: "nonzero" };
  }
  const half = strokeHalf(object);
  if (half <= 0) throw new OutlineError("That shape is empty.");
  if (sweep >= 359.5) {
    const outer = offsetClosed(centerline.slice(0, -1), half);
    const inner = offsetClosed(centerline.slice(0, -1), -half).reverse();
    return { d: `${linePath(outer, true)} ${linePath(inner, true)}`, fillRule: "evenodd" };
  }
  return { d: ribbon(centerline, half, false), fillRule: "nonzero" };
}

function lineOutline(object: Line): Outline {
  const points = object.calcLinePoints();
  const map = mapper(object);
  const start = map(points.x1, points.y1);
  const end = map(points.x2, points.y2);
  const half = strokeHalf(object) || 4;
  return { d: ribbon([start, end], half, false), fillRule: "nonzero" };
}

export function outlineOf(object: FabricObject): Outline {
  if (object instanceof Path) {
    const outline = pathOutline(object);
    if (!hasFill(object) && (object.strokeWidth ?? 0) > 0) {
      return { d: ribbon(samplePath(outline.d), strokeHalf(object), /z/i.test(outline.d)), fillRule: "nonzero" };
    }
    return outline;
  }
  if (object instanceof Rect) {
    if (!hasFill(object) && (object.strokeWidth ?? 0) > 0) {
      const outline = roundedRect(object);
      return { d: ribbon(samplePath(outline), strokeHalf(object), true), fillRule: "nonzero" };
    }
    return { d: roundedRect(object), fillRule: "nonzero" };
  }
  if (object instanceof Ellipse) {
    if (!hasFill(object) && (object.strokeWidth ?? 0) > 0) {
      const center = sampleEllipse(object, 48);
      const half = strokeHalf(object);
      const outer = offsetClosed(center, half);
      const inner = offsetClosed(center, -half).reverse();
      return { d: `${linePath(outer, true)} ${linePath(inner, true)}`, fillRule: "evenodd" };
    }
    return { d: ellipseCommands(mapper(object), object.rx ?? 0, object.ry ?? 0), fillRule: "nonzero" };
  }
  if (object instanceof Circle) return circleOutline(object);
  if (object instanceof Polygon) {
    const offsetX = object.pathOffset?.x ?? 0;
    const offsetY = object.pathOffset?.y ?? 0;
    const map = mapper(object);
    const points = (object.points ?? []).map((point) => map(point.x - offsetX, point.y - offsetY));
    if (points.length < 3) throw new OutlineError("That shape has no outline.");
    if (!hasFill(object) && (object.strokeWidth ?? 0) > 0) {
      return { d: ribbon(points, strokeHalf(object), true), fillRule: "nonzero" };
    }
    return { d: linePath(points, true), fillRule: "nonzero" };
  }
  if (object instanceof Line) return lineOutline(object);
  if (object instanceof IText) {
    throw new OutlineError("Text stays editable, so it cannot be combined.");
  }
  throw new OutlineError("That object has no outline to edit.");
}

function samplePath(d: string): Pt[] {
  const points: Pt[] = [];
  const pattern = /[MLC][^MLCZ]*/gi;
  for (const match of d.matchAll(pattern)) {
    const numbers = match[0]
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((value) => Number.isFinite(value));
    if (numbers.length >= 2) points.push({ x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] });
  }
  return points;
}

export function isClosedOutline(outline: Outline) {
  return /z/i.test(outline.d);
}

export type Guide = {
  d: string;
  closed: boolean;
};

function shapePoints(object: Polygon | Polyline) {
  const offsetX = object.pathOffset?.x ?? 0;
  const offsetY = object.pathOffset?.y ?? 0;
  const map = mapper(object);
  return (object.points ?? []).map((point) => map(point.x - offsetX, point.y - offsetY));
}

function arcGuide(object: Circle): Guide {
  const start = object.startAngle ?? 0;
  const end = object.endAngle ?? 360;
  let sweep = object.counterClockwise ? start - end : end - start;
  sweep = ((sweep % 360) + 360) % 360;
  if (sweep === 0) sweep = 360;
  const radius = object.radius ?? 0;
  const map = mapper(object);
  if (sweep >= 359.5) return { d: ellipseCommands(map, radius, radius), closed: true };
  const steps = Math.max(24, Math.ceil(sweep / 4));
  const points: Pt[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = ((start + (sweep * index) / steps) * Math.PI) / 180;
    points.push(map(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return { d: linePath(points, false), closed: false };
}

export function guideOf(object: FabricObject): Guide {
  const nested = object as FabricObject & { getObjects?: () => FabricObject[] };
  if (typeof nested.getObjects === "function" && nested.getObjects().length > 0) {
    throw new OutlineError("That object has no outline to follow.");
  }
  if (object instanceof IText) throw new OutlineError("Select a shape for the text to follow.");
  if (object instanceof Path) {
    const outline = pathOutline(object);
    return { d: outline.d, closed: isClosedOutline(outline) };
  }
  if (object instanceof Line) {
    const points = object.calcLinePoints();
    const map = mapper(object);
    return {
      d: `M ${fmt(map(points.x1, points.y1))} L ${fmt(map(points.x2, points.y2))}`,
      closed: false,
    };
  }
  if (object instanceof Circle) return arcGuide(object);
  if (object instanceof Ellipse) {
    return { d: ellipseCommands(mapper(object), object.rx ?? 0, object.ry ?? 0), closed: true };
  }
  if (object instanceof Rect) return { d: roundedRect(object), closed: true };
  if (object instanceof Polygon) {
    const points = shapePoints(object);
    if (points.length < 3) throw new OutlineError("That shape has no outline to follow.");
    return { d: linePath(points, true), closed: true };
  }
  if (object instanceof Polyline) {
    const points = shapePoints(object);
    if (points.length < 2) throw new OutlineError("That shape has no outline to follow.");
    return { d: linePath(points, false), closed: false };
  }
  throw new OutlineError("That object has no outline to follow.");
}

export type PenPoint = {
  x: number;
  y: number;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
};

function curved(point: PenPoint, handleX: number, handleY: number) {
  return Math.hypot(point.x - handleX, point.y - handleY) > 0.5;
}

export function penToSvg(points: PenPoint[], closed: boolean) {
  if (points.length === 0) return "";
  const commands = [`M ${round(points[0].x)} ${round(points[0].y)}`];
  const last = closed && points.length > 2 ? points.length : points.length - 1;
  for (let index = 1; index <= last; index += 1) {
    const from = points[(index - 1) % points.length];
    const to = points[index % points.length];
    if (curved(from, from.outX, from.outY) || curved(to, to.inX, to.inY)) {
      commands.push(
        `C ${round(from.outX)} ${round(from.outY)} ${round(to.inX)} ${round(to.inY)} ${round(to.x)} ${round(to.y)}`,
      );
    } else {
      commands.push(`L ${round(to.x)} ${round(to.y)}`);
    }
  }
  if (closed && points.length > 2) commands.push("Z");
  return commands.join(" ");
}
