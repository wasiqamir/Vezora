import Link from "next/link";
import type { ReactNode } from "react";
import { VezoraMark } from "@/components/vezora-mark";
import { AuthViewportLock } from "@/components/auth-viewport-lock";

export const authField =
  "h-10 rounded-xl border-white/12 bg-white/[0.04] px-3.5 text-white shadow-none placeholder:text-white/30 focus-visible:border-[#c4b5fd]/55 focus-visible:ring-[#c4b5fd]/20 [@media(max-height:720px)]:h-9";

export const authSubmit =
  "home-cta h-10 w-full shrink-0 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03] [@media(max-height:720px)]:h-9";

export function AuthFrame({
  title,
  lede,
  children,
  switcher,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  switcher: ReactNode;
}) {
  return (
    <>
      <AuthViewportLock />
      <main className="fixed inset-0 z-10 overflow-hidden bg-[#07041c] text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="home-glow absolute -top-28 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/40 blur-3xl" />
          <div className="home-glow-delay home-float-slow absolute top-28 -right-16 h-64 w-64 rounded-full bg-[#2563eb]/28 blur-3xl" />
          <div className="home-float absolute bottom-8 -left-20 h-56 w-72 rounded-full bg-[#c2410c]/18 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c4b5fd]/70 to-[#fdba74]/50" />
        </div>

        <div className="relative flex h-full w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
          <div className="auth-rise w-full max-w-md">
            <Link
              href="/homepage"
              className="group mb-4 flex w-fit items-center gap-2.5 [@media(max-height:720px)]:mb-3"
            >
              <span className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 h-9 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a78bfa]/40 opacity-80 blur-xl transition-opacity group-hover:opacity-100"
                />
                <VezoraMark className="relative h-8 w-12 drop-shadow-[0_8px_16px_rgba(124,58,237,0.35)]" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-[0.28em] text-white">VEZORA</span>
                <span className="block text-[11px] font-medium">
                  <span className="text-[#67e8f9]">Create.</span> <span className="text-[#d8b4fe]">Design.</span>{" "}
                  <span className="text-[#fdba74]">Inspire.</span>
                </span>
              </span>
            </Link>

            <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#100818]/80 px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-6 sm:py-6 [@media(max-height:720px)]:rounded-[1.25rem] [@media(max-height:720px)]:px-4 [@media(max-height:720px)]:py-4">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-[#7c3aed]/25 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="h-1 w-12 rounded-full bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74]"
              />
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl [@media(max-height:720px)]:mt-2 [@media(max-height:720px)]:text-xl">
                {title}
              </h1>
              <p className="mt-1.5 max-w-sm text-sm leading-snug text-white/65 [@media(max-height:720px)]:mt-1 [@media(max-height:720px)]:text-[13px]">
                {lede}
              </p>
              <div className="mt-4 [@media(max-height:720px)]:mt-3">{children}</div>
              <p className="mt-4 text-sm text-white/55 [@media(max-height:720px)]:mt-3">{switcher}</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
