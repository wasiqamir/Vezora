"use client";

import dynamic from "next/dynamic";
import type { ProjectDocument } from "@/features/projects/document";
import type { EditorFontOption } from "@/features/editor/types";

const EditorWorkspace = dynamic(
  () => import("@/features/editor/editor-workspace").then((module) => module.EditorWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-0 w-full flex-1 place-items-center text-sm text-muted-foreground">
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
}: {
  projectId: string;
  projectName: string;
  document: ProjectDocument;
  fonts: EditorFontOption[];
}) {
  return (
    <EditorWorkspace projectId={projectId} projectName={projectName} document={document} fonts={fonts} />
  );
}
