import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
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
    <Suspense fallback={<p className="bg-[#f5f6f8] px-4 py-10 text-sm text-[#16141f]/60">Loading this design…</p>}>
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
    <main className="flex-1 bg-[#f5f6f8] text-[#16141f]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-4">
          <Link href="/account" className="w-fit text-sm text-[#16141f]/60 hover:text-[#16141f]">
            Back to account
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs tracking-[0.18em] text-[#6d5bd0] uppercase">History</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{design.name}</h1>
            </div>
            <Link href={`/editor/${design.id}`} className={cn(buttonVariants(), primary)}>
              Edit
            </Link>
          </div>
        </header>
        <section className="flex flex-col gap-3 rounded-2xl border border-[#e6e4ee] bg-white p-5 shadow-[0_10px_30px_rgba(22,20,31,0.04)]">
          <h2 className="font-medium">Share</h2>
          <p className="max-w-2xl text-sm text-[#16141f]/60">
            A share link lets someone view the current design. They cannot edit it, and it stays on your account.
          </p>
          {design.shareToken ? (
            <>
              <ShareLink path={`/share/${design.shareToken}`} />
              <form action={stopSharingDesign.bind(null, design.id)}>
                <Button type="submit" variant="outline" className={quiet}>
                  Stop sharing
                </Button>
              </form>
            </>
          ) : (
            <form action={shareDesign.bind(null, design.id)}>
              <Button type="submit" className={primary}>
                Share
              </Button>
            </form>
          )}
        </section>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-2xl border border-[#e6e4ee]">
            <DesignPreview
              document={preview.document}
              imageUrl={preview.imageUrl}
              label={`${design.name}, save ${preview.number}`}
              framed
              frameClassName="h-80 sm:h-[28rem]"
            />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-medium">Saves</h2>
            <p className="text-sm text-[#16141f]/60">
              {design.saves > design.versions.length
                ? `Showing the latest ${design.versions.length} of ${design.saves} saves.`
                : "Each save stays on this account."}
            </p>
            <ol className="flex flex-col gap-2">
              {design.versions.map((version) => {
                const current = version.id === selected.id;
                return (
                  <li
                    key={version.id}
                    className={cn(
                      "rounded-2xl border bg-white p-3",
                      current ? "border-[#6d5bd0]" : "border-[#e6e4ee]",
                    )}
                  >
                    <Link href={`/account/${design.id}?version=${version.id}`} className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        {sourceLabel(version.source)}
                        {version.id === latest?.id ? " · Current" : ""}
                      </span>
                      <span className="text-xs text-[#16141f]/50">{formatWhen(version.createdAt)}</span>
                    </Link>
                    {current && version.id !== latest?.id ? (
                      <form action={restoreDesign.bind(null, design.id, version.id)} className="mt-2">
                        <Button type="submit" variant="outline" className={quiet}>
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
      </div>
    </main>
  );
}

const primary = "h-10 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]";
const quiet = "h-10 rounded-full border-[#d9d6e3] bg-white px-4 text-[#16141f] hover:bg-[#f4f2ec]";

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
