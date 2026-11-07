import { templatePreviewSvg } from "@/features/templates/preview";
import type { ProjectDocument } from "@/features/projects/document";

export function DesignPreview({
  document,
  label,
  imageUrl,
  framed = false,
  frameClassName = "h-44 bg-[#f4f2ec] px-6",
}: {
  document: ProjectDocument;
  label: string;
  imageUrl?: string | null;
  framed?: boolean;
  frameClassName?: string;
}) {
  if (imageUrl) {
    return (
      <div
        className={
          framed
            ? `flex items-center justify-center ${frameClassName}`
            : "w-full overflow-hidden rounded-lg bg-muted"
        }
        style={framed ? undefined : { aspectRatio: `${document.artboard.width} / ${document.artboard.height}` }}
      >
        <img src={imageUrl} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  const svg = templatePreviewSvg(document);
  if (framed) {
    return (
      <div className={`flex items-center justify-center ${frameClassName}`} role="img" aria-label={label}>
        <div
          className="h-full max-w-full [&_svg]:h-full [&_svg]:w-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    );
  }
  const { width, height } = document.artboard;
  return (
    <div
      className="w-full overflow-hidden rounded-lg bg-muted [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
