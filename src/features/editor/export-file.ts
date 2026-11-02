export type ExportFormat = "svg" | "png";

export type ExportScale = 1 | 2;

export type ExportBackground = "artboard" | "transparent";

export type ExportRequest = {
  projectName: string;
  format: ExportFormat;
  scale: ExportScale;
  background: ExportBackground;
};

export function projectSlug(name: string) {
  const slug = name.toLowerCase().replaceAll(" ", "-").replace(/[^a-z0-9-]/g, "");
  return slug.length > 0 ? slug : "logo";
}

export function exportFileName(projectName: string, format: ExportFormat, scale: ExportScale) {
  const slug = projectSlug(projectName);
  if (format === "svg") return `${slug}.svg`;
  return scale === 2 ? `${slug}@2x.png` : `${slug}.png`;
}

export function pngPixelSize(width: number, height: number, scale: ExportScale) {
  return { width: width * scale, height: height * scale };
}

export function objectsForExport<T extends { visible?: boolean }>(objects: T[]) {
  return objects.filter((object) => object.visible !== false);
}

export function embedImageSource(markup: string, source: string, dataUrl: string) {
  if (!source || source.startsWith("data:")) return markup;
  const escaped = source.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return markup.split(source).join(dataUrl).split(escaped).join(dataUrl);
}

export function buildSvgDocument(input: {
  width: number;
  height: number;
  background: string | null;
  shapes: string[];
}) {
  const { width, height, background, shapes } = input;
  const backgroundRect = background
    ? `<rect width="${width}" height="${height}" fill="${background}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">
<defs><clipPath id="artboard"><rect width="${width}" height="${height}"/></clipPath></defs>
<g clip-path="url(#artboard)">
${backgroundRect}
${shapes.join("\n")}
</g>
</svg>
`;
}
