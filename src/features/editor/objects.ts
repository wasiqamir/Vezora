import {
  Circle,
  Ellipse,
  FabricObject,
  IText,
  Line,
  Path,
  Polygon,
  Rect,
  loadSVGFromString,
  util,
} from "fabric";
import { iconSvg, LOGO_ICONS, type LogoIcon } from "@/features/editor/icons";
import type { FillRule } from "@/features/editor/path-geometry";
import type { LogoObjectData } from "@/features/editor/types";

const INK = "#171717";
const GREEN = "#1f6b4a";
const AMBER = "#e2a100";

export function createObjectId() {
  return `obj_${crypto.randomUUID()}`;
}

export function styleLogoObject(object: FabricObject) {
  object.set({
    transparentCorners: false,
    cornerColor: INK,
    cornerStrokeColor: "#ffffff",
    borderColor: INK,
    cornerStyle: "circle",
    cornerSize: 11,
    borderScaleFactor: 1.5,
    padding: 0,
    lockScalingFlip: true,
  });
}

export function objectChildren(object: FabricObject): FabricObject[] {
  const candidate = object as FabricObject & { getObjects?: () => FabricObject[] };
  if (typeof candidate.getObjects !== "function") return [];
  return candidate.getObjects();
}

export function createTextObject(input: {
  id: string;
  name: string;
  canvasFamily: string;
  fontId: string;
}): { object: IText; data: LogoObjectData } {
  const object = new IText("Logo", {
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    fontFamily: input.canvasFamily,
    fontSize: 72,
    fontWeight: 500,
    fill: INK,
    stroke: null,
    strokeWidth: 0,
  });
  return {
    object,
    data: { id: input.id, type: "text", name: input.name, fontId: input.fontId },
  };
}

export function createRectObject(input: { id: string; name: string }): {
  object: Rect;
  data: LogoObjectData;
} {
  const object = new Rect({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    width: 220,
    height: 220,
    fill: GREEN,
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "rect", name: input.name } };
}

export function createEllipseObject(input: { id: string; name: string }): {
  object: Ellipse;
  data: LogoObjectData;
} {
  const object = new Ellipse({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    rx: 120,
    ry: 80,
    fill: AMBER,
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "ellipse", name: input.name } };
}

export function createCircleObject(input: { id: string; name: string }): {
  object: Ellipse;
  data: LogoObjectData;
} {
  const object = new Ellipse({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    rx: 70,
    ry: 70,
    fill: INK,
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "ellipse", name: input.name } };
}

export function createRoundRectObject(input: { id: string; name: string }): {
  object: Rect;
  data: LogoObjectData;
} {
  const object = new Rect({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    width: 200,
    height: 150,
    rx: 36,
    ry: 36,
    fill: GREEN,
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "rect", name: input.name } };
}

export function createTriangleObject(input: { id: string; name: string }): {
  object: Polygon;
  data: LogoObjectData;
} {
  const object = new Polygon(
    [
      { x: 100, y: 8 },
      { x: 192, y: 168 },
      { x: 8, y: 168 },
    ],
    {
      originX: "left",
      originY: "top",
      fill: AMBER,
      stroke: null,
      strokeWidth: 0,
      strokeUniform: true,
    },
  );
  return { object, data: { id: input.id, type: "polygon", name: input.name } };
}

export function createStarObject(input: { id: string; name: string }): {
  object: Polygon;
  data: LogoObjectData;
} {
  const object = new Polygon(starPoints(5, 90, 36), {
    originX: "left",
    originY: "top",
    fill: INK,
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "polygon", name: input.name } };
}

export function createRingObject(input: { id: string; name: string }): {
  object: Ellipse;
  data: LogoObjectData;
} {
  const object = new Ellipse({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    rx: 70,
    ry: 70,
    fill: "transparent",
    stroke: INK,
    strokeWidth: 16,
    strokeUniform: true,
  });
  return { object, data: { id: input.id, type: "ellipse", name: input.name } };
}

export function createArcObject(input: { id: string; name: string }): {
  object: Circle;
  data: LogoObjectData;
} {
  const object = new Circle({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    radius: 90,
    startAngle: 20,
    endAngle: 160,
    fill: "transparent",
    stroke: INK,
    strokeWidth: 16,
    strokeLineCap: "round",
    strokeUniform: true,
    scaleY: 0.55,
  });
  return { object, data: { id: input.id, type: "arc", name: input.name } };
}

export function createLineObject(input: { id: string; name: string }): {
  object: Line;
  data: LogoObjectData;
} {
  const object = new Line([0, 0, 280, 0], {
    originX: "left",
    originY: "center",
    left: 0,
    top: 0,
    stroke: INK,
    strokeWidth: 12,
    strokeLineCap: "round",
    strokeUniform: true,
    fill: "transparent",
  });
  return { object, data: { id: input.id, type: "line", name: input.name } };
}

export async function createIconObject(input: {
  id: string;
  icon: LogoIcon;
}): Promise<{ object: FabricObject; data: LogoObjectData }> {
  const parsed = await loadSVGFromString(iconSvg(input.icon));
  const nodes = parsed.objects.filter((node): node is FabricObject => node !== null);
  const object = util.groupSVGElements(nodes, parsed.options);
  object.set({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    stroke: null,
    strokeWidth: 0,
  });
  object.scaleToWidth(180);
  object.setCoords();
  return {
    object,
    data: { id: input.id, type: "icon", name: input.icon.name, iconId: input.icon.id },
  };
}

export function createPathObject(input: {
  id: string;
  name: string;
  d: string;
  fillRule?: FillRule;
}): { object: Path; data: LogoObjectData } {
  const object = new Path(input.d, {
    originX: "left",
    originY: "top",
    fill: INK,
    fillRule: input.fillRule ?? "nonzero",
    stroke: null,
    strokeWidth: 0,
    strokeUniform: true,
  });
  styleLogoObject(object);
  return {
    object,
    data: { id: input.id, type: "path", name: input.name },
  };
}

export function findLogoIcon(iconId: string) {
  return LOGO_ICONS.find((icon) => icon.id === iconId);
}

function starPoints(spikes: number, outer: number, inner: number) {
  const points: { x: number; y: number }[] = [];
  const step = Math.PI / spikes;
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = index * step - Math.PI / 2;
    points.push({
      x: Math.round((outer + Math.cos(angle) * radius) * 1000) / 1000,
      y: Math.round((outer + Math.sin(angle) * radius) * 1000) / 1000,
    });
  }
  return points;
}
