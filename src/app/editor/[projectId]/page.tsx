import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { EditorShell } from "@/features/editor/editor-shell";
import { getEditorFontSetup } from "@/features/editor/font-setup";
import { auth } from "@/lib/auth";
import { startProject } from "@/features/account/actions";
import { getOwnedProject } from "@/features/projects/store";
import { Button } from "@/components/ui/button";

export default function EditorPage({ params }: PageProps<"/editor/[projectId]">) {
  return (
    <Suspense
      fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Opening the editor…</p>}
    >
      <EditorContent params={params} />
    </Suspense>
  );
}

async function EditorContent({ params }: { params: Promise<{ projectId: string }> }) {
  await connection();
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (projectId === "new") {
    return (
      <main className="flex flex-1 items-center justify-center bg-[#f5f6f8] px-4 py-16 text-[#16141f]">
        <div className="w-full max-w-sm rounded-3xl border border-[#e6e4ee] bg-white px-6 py-8 shadow-[0_10px_30px_rgba(22,20,31,0.04)]">
          <p className="text-xs tracking-[0.18em] text-[#6d5bd0] uppercase">New logo</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Start with a blank artboard.</h1>
          <form action={startProject} className="mt-6">
            <Button type="submit" className="h-10 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]">
              Start blank
            </Button>
          </form>
        </div>
      </main>
    );
  }
  const project = await getOwnedProject(session.user.id, projectId);
  if (!project) notFound();
  const fonts = getEditorFontSetup();

  return (
    <main className={`${fonts.className} fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#f4f2ec]`}>
      <div className="flex min-h-0 w-full flex-1">
        <EditorShell
          projectId={project.id}
          projectName={project.name}
          document={project.document}
          fonts={fonts.options}
        />
      </div>
    </main>
  );
}
