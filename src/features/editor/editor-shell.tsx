"use client";

import dynamic from "next/dynamic";
import type { ProjectDocument } from "@/features/projects/document";
import type { EditorFontOption } from "@/features/editor/types";

const EditorWorkspace = dynamic(
  () => import("@/features/editor/editor-workspace").then((module) => module.EditorWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-0 w-full flex-1 place-items-center bg-[#07041c] text-sm text-white/60">
        Opening the editor…
      </div>
    ),
  },
);

export function EditorShell({
  projectId,
  projectName,
  document,
  fonts,
  guest = false,
  templateSlug,
  openExport = false,
}: {
  projectId: string;
  projectName: string;
  document: ProjectDocument;
  fonts: EditorFontOption[];
  guest?: boolean;
  templateSlug?: string;
  openExport?: boolean;
}) {
  return (
    <EditorWorkspace
      projectId={projectId}
      projectName={projectName}
      document={document}
      fonts={fonts}
      guest={guest}
      templateSlug={templateSlug}
      openExport={openExport && !guest}
    />
  );
}
