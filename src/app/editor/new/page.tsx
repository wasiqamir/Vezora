import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageFallback } from "@/components/page-fallback";
import { ClaimGuestBridge } from "@/features/editor/claim-guest-bridge";
import { EditorShell } from "@/features/editor/editor-shell";
import { getEditorFontSetup } from "@/features/editor/font-setup";
import { blankProjectDocument } from "@/features/projects/document";
import { createBlankProject } from "@/features/projects/store";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "New logo — Vezora",
  description: "Start a blank logo on the Vezora artboard.",
};

export default function NewLogoPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; export?: string }>;
}) {
  return (
    <Suspense fallback={<PageFallback tone="dark" full />}>
      <NewLogoContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewLogoContent({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; export?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const session = await auth();

  if (session?.user?.id && (query.claim === "1" || query.export === "1")) {
    return <ClaimGuestBridge templateSlug="blank" templateName="Untitled logo" openExport />;
  }

  if (session?.user?.id) {
    const project = await createBlankProject(session.user.id);
    redirect(`/editor/${project.id}`);
  }

  const fonts = getEditorFontSetup();

  return (
    <main className={`${fonts.className} fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#07041c]`}>
      <div className="flex min-h-0 w-full flex-1">
        <EditorShell
          projectId="guest:blank"
          projectName="Untitled logo"
          document={blankProjectDocument()}
          fonts={fonts.options}
          guest
          templateSlug="blank"
        />
      </div>
    </main>
  );
}
