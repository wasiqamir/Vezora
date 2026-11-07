import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { auth } from "@/lib/auth";
import { HomeReveal } from "@/components/home-reveal";
import { PageFallback } from "@/components/page-fallback";
import { VezoraMark } from "@/components/vezora-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { restoreDesign, shareDesign, stopSharingDesign } from "@/features/projects/account-actions";
import { DesignPreview } from "@/features/projects/design-preview";
import { ShareLink } from "@/features/projects/share-link";
import { getAccountDesign, getOwnedVersion } from "@/features/projects/store";
import { isResourceId } from "@/features/reliability/limits";
import type { VersionSource } from "@/generated/prisma/client";

const cta =
  "home-cta home-cta-glow h-11 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-6 text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03]";
const quiet =
  "h-10 rounded-full border-white/15 bg-white/[0.04] px-4 text-white/85 hover:bg-white/10 hover:text-white";

export default function AccountDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  return (
    <Suspense fallback={<PageFallback tone="dark" />}>
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
  const selected =
    design.versions.find((version) => version.id === requested) ??
    design.versions[0] ??
    design.workingVersion;
  const preview = await getOwnedVersion(session.user.id, projectId, selected.id);
  if (!preview) notFound();
  const latest = design.versions[0] ?? design.workingVersion;

  return (
    <main className="relative flex-1 overflow-hidden bg-[#07041c] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="home-glow absolute -top-28 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/38 blur-3xl" />
        <div className="home-glow-delay home-float-slow absolute top-36 -right-16 h-64 w-64 rounded-full bg-[#2563eb]/25 blur-3xl" />
        <div className="home-float absolute bottom-16 -left-20 h-56 w-72 rounded-full bg-[#c2410c]/16 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:py-12">
        <HomeReveal className="flex flex-col gap-5">
          <Link
            href="/account"
            className="inline-flex w-fit items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to account
          </Link>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs tracking-[0.28em] text-white/45 uppercase">
                <VezoraMark className="h-3.5 w-5 opacity-80" />
                History
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{design.name}</h1>
              <p className="home-shimmer mt-2 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-sm font-medium text-transparent">
                Create. Design. Inspire.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
                Revisit any save, restore an earlier take, or share a view-only link. The editable project stays yours.
              </p>
            </div>
            <Link href={`/editor/${design.id}`} className={cn(buttonVariants(), cta)}>
              Edit
            </Link>
          </div>
        </HomeReveal>

        <HomeReveal delay={80}>
          <section className="home-card overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#100818] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] tracking-[0.22em] text-white/40 uppercase">Share</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">View-only link</h2>
              </div>
              {design.shareToken ? (
                <span className="mt-2 w-fit rounded-full border border-[#67e8f9]/30 bg-[#67e8f9]/12 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-[#67e8f9] uppercase sm:mt-0">
                  Live
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Anyone with the link can view the current design. They cannot edit it, and the project stays on your
              account.
            </p>
            <div className="mt-5 flex flex-col gap-3">
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
                  <Button type="submit" className={cn(cta, "h-10 px-5")}>
                    Create share link
                  </Button>
                </form>
              )}
            </div>
          </section>
        </HomeReveal>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <HomeReveal delay={120} from="left">
            <div className="home-card overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#100818] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
                <p className="text-xs tracking-[0.18em] text-white/45 uppercase">Preview</p>
                <p className="text-xs text-white/40">
                  Save {preview.number}
                  {selected.id === latest?.id ? " · Current" : ""}
                </p>
              </div>
              <div className="relative bg-[#0a0618]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(103,232,249,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(251,146,60,0.08),transparent_45%)]"
                />
                <DesignPreview
                  document={preview.document}
                  imageUrl={preview.imageUrl}
                  label={`${design.name}, save ${preview.number}`}
                  framed
                  frameClassName="relative h-80 bg-transparent px-6 sm:h-[28rem]"
                />
              </div>
            </div>
          </HomeReveal>

          <HomeReveal delay={160} from="right">
            <div className="home-card flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-[#100818] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
              <p className="text-[11px] tracking-[0.22em] text-white/40 uppercase">Saves</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Version trail</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {design.saves === 0
                  ? "Exports appear here. Editing the artboard does not add a save."
                  : design.saves > design.versions.length
                    ? `Showing the latest ${design.versions.length} of ${design.saves} exports.`
                    : "Each export stays on this account."}
              </p>
              <ol className="mt-5 flex flex-col gap-2">
                {design.versions.length === 0 ? (
                  <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/50">
                    No exports yet.
                  </li>
                ) : null}
                {design.versions.map((version) => {
                  const current = version.id === selected.id;
                  return (
                    <li
                      key={version.id}
                      className={cn(
                        "rounded-2xl border p-3 transition-colors",
                        current
                          ? "border-[#c4b5fd]/55 bg-[#c4b5fd]/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20",
                      )}
                    >
                      <Link
                        href={`/account/${design.id}?version=${version.id}`}
                        className="flex flex-col gap-1"
                      >
                        <span className="text-sm font-medium text-white">
                          {sourceLabel(version.source)}
                          {version.id === latest?.id ? (
                            <span className="ml-2 text-[10px] tracking-[0.14em] text-[#67e8f9] uppercase">
                              Current
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-white/45">{formatWhen(version.createdAt)}</span>
                      </Link>
                      {current && version.id !== latest?.id ? (
                        <form action={restoreDesign.bind(null, design.id, version.id)} className="mt-3">
                          <Button type="submit" variant="outline" className={cn(quiet, "w-full")}>
                            Use this version
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </HomeReveal>
        </section>
      </div>
    </main>
  );
}

function sourceLabel(source: VersionSource) {
  if (source === "autosave") return "Autosaved";
  if (source === "duplicate") return "Copied";
  if (source === "template") return "Started from a template";
  if (source === "reconstruction") return "Built from an image";
  if (source === "export") return "Exported";
  return "Saved";
}

function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
