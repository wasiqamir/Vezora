import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { DesignPreview } from "@/features/projects/design-preview";
import { getSharedProject } from "@/features/projects/store";
import { isResourceId } from "@/features/reliability/limits";
import { buttonVariants } from "@/components/ui/button";

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading this design…</p>}>
      <ShareContent params={params} />
    </Suspense>
  );
}

async function ShareContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const design = isResourceId(token) ? await getSharedProject(token) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      {design ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Shared from Vezora</p>
            <h1 className="text-2xl font-semibold tracking-tight">{design.name}</h1>
          </div>
          <DesignPreview document={design.document} imageUrl={design.imageUrl} label={design.name} />
          <p className="text-sm text-muted-foreground">This is a view of the current design. Editing stays with the owner.</p>
          <Link href="/sign-up" className={buttonVariants({ className: "w-fit" })}>
            Create your own
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This design is not shared.</h1>
          <p className="text-sm text-muted-foreground">The link may have been turned off, or it was never shared.</p>
        </>
      )}
    </main>
  );
}
