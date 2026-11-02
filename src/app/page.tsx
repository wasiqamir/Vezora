import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { HomeScrollLock } from "@/components/home-scroll-lock";
import { Button } from "@/components/ui/button";
import { VezoraMark } from "@/components/vezora-mark";
import { auth } from "@/lib/auth";
import { startProject } from "@/features/account/actions";

export const metadata = {
  title: "Vezora — Create. Design. Inspire.",
  description: "A logo studio for marks you can reopen, edit, and export as SVG or PNG.",
};

const toolGlyphs = [
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 2.5 12 7.2l-4 .7-.2 4.2z"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 13.2 11.6 4.6l1 1L4 14.2z"/><path d="m10.8 3.8 1.4-1.4 1.6 1.6-1.4 1.4"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 3.5h5.2a2.6 2.6 0 0 1 0 5.2H4zM4 8.7h6.2"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="4.2"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.2"/></svg>`,
];

export default function HomePage() {
  return (
    <HomeStudio
      start={
        <Suspense fallback={<Link href="/sign-up" className={primaryAction}>Start a logo</Link>}>
          <StartLink />
        </Suspense>
      }
    />
  );
}

function HomeStudio({ start }: { start: ReactNode }) {
  return (
    <main className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden bg-[#07041c] text-white">
      <HomeScrollLock />
      <section className="relative flex min-h-0 flex-1 items-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/40 blur-3xl" />
          <div className="absolute top-24 -right-20 h-72 w-72 rounded-full bg-[#2563eb]/30 blur-3xl" />
          <div className="absolute bottom-0 -left-16 h-64 w-80 rounded-full bg-[#c2410c]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-h-full w-full max-w-6xl items-center gap-6 overflow-hidden px-4 py-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-8">
          <div className="flex min-w-0 flex-col items-start">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/75">
              <VezoraMark className="h-4 w-6" />
              Logo studio
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Design a mark you can reopen.
            </h1>
            <p className="mt-3 text-lg font-medium">
              <span className="text-[#7dd3fc]">Create.</span>{" "}
              <span className="text-[#d8b4fe]">Design.</span>{" "}
              <span className="text-[#fdba74]">Inspire.</span>
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/70">
              Vezora is a vector workspace for wordmarks, icons, and layouts. Draw on an artboard, keep every layer,
              and export SVG or PNG when the identity is ready.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {start}
              <Link href="/templates" className={secondaryAction}>
                Browse templates
              </Link>
            </div>
          </div>
          <EditorPreview />
        </div>
      </section>
    </main>
  );
}

function EditorPreview() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#120a22] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="size-2.5 rounded-full bg-[#fb7185]" />
          <i className="size-2.5 rounded-full bg-[#fbbf24]" />
          <i className="size-2.5 rounded-full bg-[#34d399]" />
        </span>
        <p className="text-xs text-white/70">Untitled logo</p>
        <p className="ml-auto text-[10px] tracking-wide text-white/40">SVG · PNG</p>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
        <div className="grid content-start gap-1.5" aria-hidden="true">
          {toolGlyphs.map((glyph) => (
            <span
              key={glyph}
              className="grid h-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70"
              dangerouslySetInnerHTML={{ __html: glyph }}
            />
          ))}
        </div>
        <div className="relative aspect-[4/3] max-h-[min(22rem,42dvh)] min-w-0 overflow-hidden rounded-2xl lg:max-h-[min(28rem,calc(100dvh-16rem))]">
          <Image
            src="/vezora-canvas.jpg"
            alt="Emerald mark on a violet and gold field"
            fill
            priority
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}

const primaryAction =
  "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-[#14081f] transition-colors hover:bg-white/90";

const secondaryAction =
  "inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10";

async function StartLink() {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return (
      <Link href="/sign-up" className={primaryAction}>
        Start a logo
      </Link>
    );
  }
  return (
    <form action={startProject}>
      <Button type="submit" className={primaryAction}>
        Start a logo
      </Button>
    </form>
  );
}
