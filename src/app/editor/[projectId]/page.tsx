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
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">New logo</h1>
        <form action={startProject}>
          <Button type="submit">Start blank</Button>
        </form>
      </main>
    );
  }
  const project = await getOwnedProject(session.user.id, projectId);
  if (!project) notFound();
  const fonts = getEditorFontSetup();

  return (
    <main className={`${fonts.className} flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col`}>
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
