import { templatePreviewSvg } from "@/features/templates/preview";
import type { ProjectDocument } from "@/features/projects/document";

export function DesignPreview({
  document,
  label,
  framed = false,
  frameClassName = "h-44",
}: {
  document: ProjectDocument;
  label: string;
  framed?: boolean;
  frameClassName?: string;
}) {
  const svg = templatePreviewSvg(document);
  if (framed) {
    return (
      <div
        className={`flex items-center justify-center bg-[#f4f2ec] px-6 ${frameClassName}`}
        role="img"
        aria-label={label}
      >
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
