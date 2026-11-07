import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageFallback } from "@/components/page-fallback";
import { ClaimGuestBridge } from "@/features/editor/claim-guest-bridge";
import { EditorShell } from "@/features/editor/editor-shell";
import { getEditorFontSetup } from "@/features/editor/font-setup";
import { auth } from "@/lib/auth";
import { resolvePublishedTemplate } from "@/features/templates/store";

export const metadata = {
  title: "Try template — Vezora",
  description: "Open a Vezora template on the artboard and start editing.",
};

export default function TryTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ claim?: string; export?: string }>;
}) {
  return (
    <Suspense fallback={<PageFallback tone="dark" full />}>
      <TryTemplateContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TryTemplateContent({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ claim?: string; export?: string }>;
}) {
  await connection();
  const { templateId } = await params;
  const query = await searchParams;
  const template = await resolvePublishedTemplate(decodeURIComponent(templateId));
  if (!template) notFound();

  const session = await auth();
  if (session?.user?.id && (query.claim === "1" || query.export === "1")) {
    return (
      <ClaimGuestBridge
        templateSlug={template.slug}
        templateName={template.name}
        openExport={query.export === "1" || query.claim === "1"}
      />
    );
  }

  const fonts = getEditorFontSetup();

  return (
    <main className={`${fonts.className} fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#07041c]`}>
      <div className="flex min-h-0 w-full flex-1">
        <EditorShell
          projectId={`guest:${template.slug}`}
          projectName={template.name}
          document={template.document}
          fonts={fonts.options}
          guest
          templateSlug={template.slug}
        />
      </div>
    </main>
  );
}
