"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { signOutAction } from "@/features/account/actions";
import { VezoraMark } from "@/components/vezora-mark";

const links = [
  { href: "/templates", label: "Templates" },
  { href: "/account", label: "Account" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const onTemplates = pathname === "/templates" || pathname.startsWith("/templates/");
  const studio =
    pathname === "/homepage" ||
    onTemplates ||
    pathname === "/account" ||
    pathname.startsWith("/account/");
  if (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname.startsWith("/editor")
  ) {
    // Includes /editor/try/... so the artboard stays full-bleed.
    return null;
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 isolate overflow-visible",
        studio
          ? "bg-[linear-gradient(180deg,rgba(26,18,48,0.94)_0%,rgba(14,9,28,0.9)_100%)] text-white backdrop-blur-2xl"
          : "bg-[linear-gradient(180deg,rgba(255,252,248,0.97)_0%,rgba(244,239,248,0.94)_100%)] text-[#1a1528] backdrop-blur-2xl",
      )}
      style={
        studio
          ? {
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.14) inset, 0 22px 48px -20px rgba(109,40,217,0.75), 0 34px 70px -26px rgba(234,88,12,0.38), 0 10px 24px -14px rgba(0,0,0,0.65)",
            }
          : {
              boxShadow:
                "0 1px 0 rgba(255,255,255,1) inset, 0 18px 40px -18px rgba(76,29,149,0.32), 0 28px 54px -24px rgba(194,65,12,0.2), 0 8px 18px -12px rgba(22,20,31,0.14)",
            }
      }
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-10 top-0 h-px",
          studio
            ? "bg-gradient-to-r from-transparent via-[#e9d5ff]/80 to-transparent"
            : "bg-gradient-to-r from-transparent via-[#a78bfa]/65 to-transparent",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-8 left-[12%] h-12 w-[38%] blur-2xl",
          studio ? "bg-[#7c3aed]/55" : "bg-[#a78bfa]/35",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-7 right-[14%] h-11 w-[32%] blur-2xl",
          studio ? "bg-[#ea580c]/40" : "bg-[#fdba74]/35",
        )}
      />
      <div className="relative mx-auto flex h-[4.75rem] w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/homepage" className="group flex shrink-0 items-center gap-3">
          <span className="relative">
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 left-1/2 h-11 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl transition-opacity duration-300 group-hover:opacity-100",
                studio ? "bg-[#a78bfa]/45 opacity-80" : "bg-[#c4b5fd]/70 opacity-70",
              )}
            />
            <VezoraMark className="relative h-11 w-16 drop-shadow-[0_8px_16px_rgba(124,58,237,0.35)]" />
          </span>
          <span className="leading-tight">
            <span
              className={cn(
                "block text-sm font-semibold tracking-[0.28em]",
                studio ? "text-white drop-shadow-[0_2px_12px_rgba(196,181,253,0.35)]" : "text-[#1a1528]",
              )}
            >
              VEZORA
            </span>
            <span className="block text-[11px] font-medium">
              <span className="text-[#67e8f9]">Create.</span> <span className="text-[#d8b4fe]">Design.</span>{" "}
              <span className="text-[#fdba74]">Inspire.</span>
            </span>
          </span>
        </Link>
        <nav className="mx-auto flex items-center gap-1.5">
          {links.map((link) => {
            if (!signedIn && link.href === "/account") return null;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.95rem] font-semibold tracking-wide transition-all duration-200",
                  studio
                    ? "text-white/90 hover:bg-white/12 hover:text-white hover:shadow-[0_10px_22px_-14px_rgba(196,181,253,0.85)]"
                    : "text-[#1a1528]/82 hover:bg-white hover:text-[#1a1528] hover:shadow-[0_10px_20px_-14px_rgba(91,33,182,0.35)]",
                  studio &&
                    active &&
                    "bg-white/16 text-white shadow-[0_12px_26px_-12px_rgba(196,181,253,1),inset_0_1px_0_rgba(255,255,255,0.28)]",
                  !studio &&
                    active &&
                    "bg-white text-[#1a1528] shadow-[0_12px_24px_-12px_rgba(91,33,182,0.45),inset_0_1px_0_rgba(255,255,255,1)]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {signedIn ? (
          <div className="flex shrink-0 items-center gap-2">
            {onTemplates ? (
              <Link
                href="/editor/new"
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-transform duration-200 hover:-translate-y-0.5",
                  "bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] text-[#1a1028] shadow-[0_12px_28px_-10px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.55),inset_0_1px_0_rgba(255,255,255,1)]",
                )}
              >
                Create own Logo
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5",
                  studio
                    ? "border-white/20 bg-white/8 text-white shadow-[0_10px_22px_-12px_rgba(196,181,253,0.7),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-white/14"
                    : "border-[#d9d4e8] bg-white text-[#1a1528] shadow-[0_10px_20px_-12px_rgba(91,33,182,0.28),inset_0_1px_0_rgba(255,255,255,1)] hover:border-[#c4b5fd]",
                )}
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/sign-in"
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5",
                studio
                  ? "border-white/20 bg-white/8 text-white shadow-[0_10px_22px_-12px_rgba(196,181,253,0.7),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-white/14"
                  : "border-[#d9d4e8] bg-white text-[#1a1528] shadow-[0_10px_20px_-12px_rgba(91,33,182,0.28),inset_0_1px_0_rgba(255,255,255,1)] hover:border-[#c4b5fd]",
              )}
            >
              Sign in
            </Link>
            <Link
              href={onTemplates ? "/editor/new" : "/templates"}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-transform duration-200 hover:-translate-y-0.5",
                studio
                  ? "bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] text-[#1a1028] shadow-[0_12px_28px_-10px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.55),inset_0_1px_0_rgba(255,255,255,1)]"
                  : "bg-[linear-gradient(135deg,#1a1528_0%,#2a1f45_60%,#3b2358_100%)] text-white shadow-[0_12px_26px_-10px_rgba(76,29,149,0.55),0_8px_16px_-12px_rgba(194,65,12,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]",
              )}
            >
              {onTemplates ? "Create own Logo" : "Start a logo"}
            </Link>
          </div>
        )}
      </div>
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-[#c4b5fd] to-[#fdba74] opacity-90"
      />
      <div
        aria-hidden="true"
        className={cn(
          "h-px bg-gradient-to-r from-transparent via-[#67e8f9]/40 to-transparent blur-[1px]",
          studio ? "opacity-70" : "opacity-40",
        )}
      />
    </header>
  );
}
