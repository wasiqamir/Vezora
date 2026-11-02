import { templatePreviewSvg } from "@/features/templates/preview";
import type { ProjectDocument } from "@/features/projects/document";

export function DesignPreview({ document, label }: { document: ProjectDocument; label: string }) {
  const { width, height } = document.artboard;
  return (
    <div
      className="w-full overflow-hidden rounded-lg bg-muted [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: templatePreviewSvg(document) }}
    />
  );
}
