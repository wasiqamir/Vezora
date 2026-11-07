"use client";

import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { VezoraMark } from "@/components/vezora-mark";
import { guestAuthReturnPath } from "@/features/editor/guest-draft";

export function ExportAuthDialog({
  templateSlug,
  onClose,
}: {
  templateSlug: string;
  onClose: () => void;
}) {
  const returnPath = guestAuthReturnPath(templateSlug);
  const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(returnPath)}`;
  const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(returnPath)}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050214]/72 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-auth-title"
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(165deg,rgba(28,16,52,0.98)_0%,rgba(10,6,22,0.98)_100%)] p-7 text-white shadow-[0_40px_100px_-28px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#e9d5ff]/80 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#7c3aed]/35 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-[#ea580c]/20 blur-3xl"
        />

        <button
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>

        <div className="relative flex flex-col items-center text-center">
          <span className="relative inline-flex">
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 h-14 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a78bfa]/35 blur-xl"
            />
            <VezoraMark className="relative h-12 w-16 drop-shadow-[0_10px_20px_rgba(124,58,237,0.4)]" />
          </span>
          <p className="mt-4 text-[11px] tracking-[0.28em] text-white/45 uppercase">Export</p>
          <h2 id="export-auth-title" className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            Sign in or sign up to save.
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">
            Guests can design freely. To download, sign in or create an account — we&apos;ll bring you straight back to
            the download form with this logo ready.
          </p>
          <p className="mt-4 text-[11px] font-medium">
            <span className="text-[#67e8f9]">Create.</span> <span className="text-[#d8b4fe]">Design.</span>{" "}
            <span className="text-[#fdba74]">Inspire.</span>
          </p>

          <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href={signInHref}
              className={cn(
                buttonVariants(),
                "home-cta h-11 flex-1 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03] sm:flex-none sm:px-7",
              )}
            >
              Sign in
            </Link>
            <Link
              href={signUpHref}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 flex-1 rounded-full border-white/15 bg-white/[0.04] text-sm font-medium text-white hover:bg-white/10 hover:text-white sm:flex-none sm:px-7",
              )}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
