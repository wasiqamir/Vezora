const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

export type VectorPath = {
  d: string;
  fill: string;
  fillRule: "evenodd" | "nonzero";
  x: number;
  y: number;
  width: number;
  height: number;
};

export function pathsFromSvg(svg: string, imageWidth: number, imageHeight: number) {
  const paths: VectorPath[] = [];
  for (const match of svg.matchAll(/<path\b([^>]*)\/?>/gi)) {
    const attrs = match[1] ?? "";
    const d = attribute(attrs, "d");
    if (!d) continue;
    const fill = normalizeColor(attribute(attrs, "fill")) ?? "#171717";
    const rule = attribute(attrs, "fill-rule") === "evenodd" ? "evenodd" : "nonzero";
    const box = pathBounds(d);
    if (!box || box.width < 2 || box.height < 2) continue;
    if (isBackdrop(fill, box, imageWidth, imageHeight)) continue;
    if (d.length > 180_000) continue;
    paths.push({ d, fill, fillRule: rule, ...box });
  }
  paths.sort((left, right) => right.width * right.height - left.width * left.height);
  return paths.slice(0, 120);
}

function attribute(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(['"])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function normalizeColor(value: string | null) {
  if (!value || value === "none") return null;
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  const rgb = hex.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!rgb) return null;
  return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
}

function channel(value: string | undefined) {
  return Number(value ?? 0).toString(16).padStart(2, "0");
}

function isBackdrop(fill: string, box: { width: number; height: number }, imageWidth: number, imageHeight: number) {
  const coverage = (box.width * box.height) / Math.max(1, imageWidth * imageHeight);
  return coverage > 0.72 && luminance(fill) > 0.9;
}

function luminance(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function pathBounds(d: string) {
  const commands = tokenize(d);
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const mark = (px: number, py: number) => {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  for (const command of commands) {
    const name = command.cmd.toUpperCase();
    const relative = command.cmd === name.toLowerCase() && command.cmd !== "Z";
    const arity = ARITY[name];
    if (arity === undefined) continue;
    if (name === "Z") {
      x = startX;
      y = startY;
      continue;
    }
    const groups = Math.floor(command.args.length / arity);
    for (let group = 0; group < groups; group += 1) {
      const args = command.args.slice(group * arity, (group + 1) * arity);
      const point = (index: number, base: number) => (relative ? base + (args[index] ?? 0) : (args[index] ?? 0));
      const drawn = name === "M" && group > 0 ? "L" : name;
      if (drawn === "M" || drawn === "L" || drawn === "T") {
        x = point(0, x);
        y = point(1, y);
        if (drawn === "M" && group === 0) {
          startX = x;
          startY = y;
        }
        mark(x, y);
      } else if (drawn === "H") {
        x = point(0, x);
        mark(x, y);
      } else if (drawn === "V") {
        y = point(0, y);
        mark(x, y);
      } else if (drawn === "C") {
        mark(point(0, x), point(1, y));
        mark(point(2, x), point(3, y));
        x = point(4, x);
        y = point(5, y);
        mark(x, y);
      } else if (drawn === "S" || drawn === "Q") {
        mark(point(0, x), point(1, y));
        x = point(2, x);
        y = point(3, y);
        mark(x, y);
      } else if (drawn === "A") {
        const radiusX = Math.abs(args[0] ?? 0);
        const radiusY = Math.abs(args[1] ?? 0);
        x = point(5, x);
        y = point(6, y);
        mark(x - radiusX, y - radiusY);
        mark(x + radiusX, y + radiusY);
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return {
    x: round(minX),
    y: round(minY),
    width: Math.max(1, round(maxX - minX)),
    height: Math.max(1, round(maxY - minY)),
  };
}

function tokenize(d: string) {
  const commands: { cmd: string; args: number[] }[] = [];
  let current: { cmd: string; args: number[] } | null = null;
  for (const match of d.matchAll(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)) {
    const token = match[0];
    if (/[A-Za-z]/.test(token)) {
      if (current) commands.push(current);
      current = { cmd: token, args: [] };
    } else if (current) {
      current.args.push(Number(token));
    }
  }
  if (current) commands.push(current);
  return commands;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
