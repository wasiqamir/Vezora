import Link from "next/link";
import type { ReactNode } from "react";
import { VezoraMark } from "@/components/vezora-mark";

export const authField =
  "h-10 rounded-xl border-[#e7dfd2] bg-[#fffcf8] px-3 text-[#1c1730] shadow-none placeholder:text-[#1c1730]/35 focus-visible:border-[#6d5bd0] focus-visible:ring-[#6d5bd0]/25";

export const authSubmit =
  "h-10 w-full shrink-0 rounded-full bg-[#1c1730] text-sm font-medium text-white hover:bg-[#2c2644]";

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
    <main className="flex min-h-dvh flex-1 flex-col bg-[#f3eee6] text-[#1c1730]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:py-8">
        <div className="my-auto w-full pb-2">
          <Link href="/" className="mb-3 flex w-fit items-center gap-2">
            <VezoraMark className="h-6 w-9" />
            <span className="text-sm font-semibold tracking-tight">Vezora</span>
          </Link>
          <section className="auth-rise rounded-[1.75rem] bg-white px-5 py-4 shadow-[0_24px_60px_rgba(28,23,48,0.08)] ring-1 ring-[#1c1730]/10 sm:px-7 sm:py-6">
            <div
              className="h-1 w-14 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#22d3ee] to-[#fb923c]"
              aria-hidden="true"
            />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm leading-snug text-[#1c1730]/65">{lede}</p>
            <div className="mt-4">{children}</div>
            <p className="mt-3 text-sm text-[#1c1730]/60">{switcher}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
