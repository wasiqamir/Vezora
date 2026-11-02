import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { restoreDesign, shareDesign, stopSharingDesign } from "@/features/projects/account-actions";
import { DesignPreview } from "@/features/projects/design-preview";
import { ShareLink } from "@/features/projects/share-link";
import { getAccountDesign, getOwnedVersion } from "@/features/projects/store";
import { isResourceId } from "@/features/reliability/limits";
import type { VersionSource } from "@/generated/prisma/client";

export default function AccountDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading this design…</p>}>
      <AccountDesignContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountDesignContent({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { projectId } = await params;
  const query = await searchParams;
  if (!isResourceId(projectId)) notFound();
  const design = await getAccountDesign(session.user.id, projectId);
  if (!design) notFound();
  const requested = query.version && isResourceId(query.version) ? query.version : design.versions[0]?.id;
  const selected = design.versions.find((version) => version.id === requested) ?? design.versions[0];
  if (!selected) notFound();
  const preview = await getOwnedVersion(session.user.id, projectId, selected.id);
  if (!preview) notFound();
  const latest = design.versions[0];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/account" className="text-sm text-muted-foreground">
          Back to account
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{design.name}</h1>
          <Link href={`/editor/${design.id}`} className={buttonVariants()}>
            Edit
          </Link>
        </div>
      </div>
      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-medium">Share</h2>
        <p className="text-sm text-muted-foreground">
          A share link lets someone view the current design. They cannot edit it, and it stays on your account.
        </p>
        {design.shareToken ? (
          <>
            <ShareLink path={`/share/${design.shareToken}`} />
            <form action={stopSharingDesign.bind(null, design.id)}>
              <Button type="submit" variant="outline">
                Stop sharing
              </Button>
            </form>
          </>
        ) : (
          <form action={shareDesign.bind(null, design.id)}>
            <Button type="submit">Share</Button>
          </form>
        )}
      </section>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <DesignPreview document={preview.document} label={`${design.name}, save ${preview.number}`} />
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">History</h2>
          <p className="text-sm text-muted-foreground">
            {design.saves > design.versions.length
              ? `Showing the latest ${design.versions.length} of ${design.saves} saves.`
              : "Each save stays on this account."}
          </p>
          <ol className="flex flex-col gap-2">
            {design.versions.map((version) => {
              const current = version.id === selected.id;
              return (
                <li key={version.id} className="rounded-lg border p-3">
                  <Link href={`/account/${design.id}?version=${version.id}`} className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      {sourceLabel(version.source)}
                      {version.id === latest?.id ? " · Current" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatWhen(version.createdAt)}</span>
                  </Link>
                  {current && version.id !== latest?.id ? (
                    <form action={restoreDesign.bind(null, design.id, version.id)} className="mt-2">
                      <Button type="submit" variant="outline">
                        Use this version
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </main>
  );
}

function sourceLabel(source: VersionSource) {
  if (source === "autosave") return "Autosaved";
  if (source === "duplicate") return "Copied";
  if (source === "template") return "Started from a template";
  if (source === "reconstruction") return "Built from an image";
  return "Saved";
}

function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
