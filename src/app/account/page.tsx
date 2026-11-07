import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { auth } from "@/lib/auth";
import { HomeReveal } from "@/components/home-reveal";
import { PageFallback } from "@/components/page-fallback";
import { VezoraMark } from "@/components/vezora-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { AccountStats } from "@/features/account/account-stats";
import { startProject } from "@/features/account/actions";
import { DesignPreview } from "@/features/projects/design-preview";
import { listAccountDesigns } from "@/features/projects/store";

export const metadata = {
  title: "Account — Vezora",
  description: "The logos and saved history on your Vezora account.",
};

const cta =
  "home-cta home-cta-glow h-11 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-6 text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03]";
const quiet =
  "h-11 rounded-full border-white/15 bg-white/[0.04] px-5 text-white/85 hover:bg-white/10 hover:text-white";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageFallback tone="dark" />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const designs = await listAccountDesigns(session.user.id);
  const name = session.user.name?.trim() || "Creator";
  const firstName = name.split(/\s+/)[0] || "Creator";
  const sharedCount = designs.filter((design) => design.shared).length;
  // Logos = designs that have been exported at least once (not every draft project).
  const logoCount = designs.filter((design) => design.exported).length;
  const saveCount = designs.reduce((total, design) => total + design.saves, 0);

  return (
    <main className="relative flex-1 overflow-hidden bg-[#07041c] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="home-glow absolute -top-28 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/40 blur-3xl" />
        <div className="home-glow-delay home-float-slow absolute top-32 -right-20 h-72 w-72 rounded-full bg-[#2563eb]/28 blur-3xl" />
        <div className="home-float absolute bottom-24 -left-16 h-64 w-80 rounded-full bg-[#c2410c]/18 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(103,232,249,0.08),transparent_42%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:gap-12 sm:py-14">
        <HomeReveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/75">
              <span className="home-mark-pulse inline-flex rounded-full">
                <VezoraMark className="h-4 w-6" />
              </span>
              Your studio
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {firstName}, your marks live here.
            </h1>
            <p className="home-shimmer mt-3 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-lg font-medium text-transparent">
              Create. Design. Inspire.
            </p>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/65">
              {session.user.email ? (
                <>
                  Signed in as <span className="text-white/90">{session.user.email}</span>.{" "}
                </>
              ) : null}
              Every save, version, and share link stays with this account — ready to reopen whenever the mark needs
              another pass.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }), quiet)}>
              Browse templates
            </Link>
            <form action={startProject}>
              <Button type="submit" className={cta}>
                New logo
              </Button>
            </form>
          </div>
        </HomeReveal>

        <HomeReveal delay={80}>
          <AccountStats initial={{ logos: logoCount, saves: saveCount, shared: sharedCount }} />
        </HomeReveal>

        {designs.length === 0 ? (
          <HomeReveal delay={120} from="scale">
            <div className="home-card relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#100818] px-6 py-16 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:px-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(167,139,250,0.22),transparent_55%)]"
              />
              <span className="home-float relative inline-flex">
                <VezoraMark className="h-14 w-20 drop-shadow-[0_12px_28px_rgba(124,58,237,0.45)]" />
              </span>
              <h2 className="relative mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
                The board is waiting.
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
                Start a blank mark or open a template. The first save lands here with every layer intact.
              </p>
              <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
                <form action={startProject}>
                  <Button type="submit" className={cta}>
                    Start blank
                  </Button>
                </form>
                <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }), quiet)}>
                  Browse templates
                </Link>
              </div>
            </div>
          </HomeReveal>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((design, index) => (
              <HomeReveal key={design.id} delay={100 + index * 70} from="scale" className="h-full">
                <article className="home-card group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#100818] shadow-[0_24px_60px_rgba(0,0,0,0.28)] transition-[border-color,box-shadow] hover:border-[#c4b5fd]/35 hover:shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
                  <Link
                    href={`/editor/${design.id}`}
                    className="absolute inset-0 z-[1]"
                    aria-label={`Open ${design.name}`}
                  />
                  <div className="relative overflow-hidden border-b border-white/8 bg-[#0a0618]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,0.08),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(251,146,60,0.08),transparent_40%)]"
                    />
                    <DesignPreview
                      document={design.document}
                      imageUrl={design.imageUrl}
                      label={design.name}
                      framed
                      frameClassName="relative h-48 bg-transparent px-6 sm:h-52"
                    />
                    {design.shared ? (
                      <span className="absolute top-3 right-3 z-[2] rounded-full border border-[#fdba74]/35 bg-[#fdba74]/15 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-[#fdba74] uppercase">
                        Shared
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col px-5 py-4">
                    <h2 className="text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-[#d8b4fe]">
                      {design.name}
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                      {design.saves === 1 ? "1 save" : `${design.saves} saves`}
                      {" · "}
                      Edited {formatWhen(design.updatedAt)}
                    </p>
                    <div className="relative z-[2] mt-5 flex flex-wrap gap-2">
                      <Link href={`/editor/${design.id}`} className={cn(buttonVariants(), cta, "h-10 px-4")}>
                        Edit
                      </Link>
                      <Link
                        href={`/account/${design.id}`}
                        className={cn(buttonVariants({ variant: "outline" }), quiet, "h-10 px-4")}
                      >
                        History
                      </Link>
                    </div>
                  </div>
                </article>
              </HomeReveal>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(value);
}
