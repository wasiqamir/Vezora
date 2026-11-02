import { LOGO_ICONS } from "@/features/editor/icons";
import type { ProjectDocument, ProjectObject } from "@/features/projects/document";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shape(object: ProjectObject) {
  const fill = object.fill ?? "none";
  const stroke = object.stroke ?? "none";
  const strokeWidth = object.strokeWidth ?? 0;
  if (object.type === "rect") {
    return `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  if (object.type === "ellipse") {
    const rx = object.rx ?? object.width / 2;
    const ry = object.ry ?? object.height / 2;
    return `<ellipse cx="${object.x + rx}" cy="${object.y + ry}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  if (object.type === "text") {
    const size = object.fontSize ?? 32;
    const weight = object.fontWeight ?? 500;
    const family = escapeXml(object.fontFamily ?? "Outfit");
    const spacing = ((object.letterSpacing ?? 0) / 1000) * size;
    return `<text x="${object.x}" y="${object.y + size * 0.82}" fill="${fill}" font-family="${family}, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escapeXml(object.text ?? "")}</text>`;
  }
  if (object.type === "path" && object.path) {
    const rule = object.fillRule === "evenodd" ? "evenodd" : "nonzero";
    const scaleX = object.scaleX || 1;
    const scaleY = object.scaleY || 1;
    return `<g transform="translate(${object.x} ${object.y}) scale(${scaleX} ${scaleY})"><path d="${escapeXml(object.path)}" transform="translate(${-object.x} ${-object.y})" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-rule="${rule}"/></g>`;
  }
  if (object.type === "icon" && object.iconId) {
    const icon = LOGO_ICONS.find((entry) => entry.id === object.iconId);
    if (!icon) return "";
    const paths = icon.paths
      .map((path) => {
        const rule = path.rule ? ` fill-rule="${path.rule}"` : "";
        return `<path${rule} fill="${fill}" d="${path.d}"/>`;
      })
      .join("");
    const scaleX = object.width / 100;
    const scaleY = object.height / 100;
    return `<g transform="translate(${object.x} ${object.y}) scale(${scaleX} ${scaleY})">${paths}</g>`;
  }
  return "";
}

export function templatePreviewSvg(document: ProjectDocument) {
  const { width, height, background } = document.artboard;
  const shapes = document.objects.filter((object) => object.visible).map(shape).join("");
  const ground = background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">${ground}${shapes}</svg>`;
}
