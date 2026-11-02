"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { signOutAction } from "@/features/account/actions";
import { VezoraMark } from "@/components/vezora-mark";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Account" },
  { href: "/templates", label: "Templates" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const studio = pathname === "/";
  if (pathname === "/sign-in" || pathname === "/sign-up" || pathname.startsWith("/editor")) return null;

  return (
    <header
      className={cn(
        "z-30 border-b",
        studio
          ? "sticky top-0 border-white/10 bg-[#07041c]/80 text-white backdrop-blur-md"
          : "border-border bg-background",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 bg-transparent">
          <VezoraMark className="h-8 w-12" />
          <span className={cn("text-base font-semibold tracking-tight", studio ? "text-white" : "text-[#16141f]")}>
            Vezora
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            if (!signedIn && link.href === "/account") return null;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-sm",
                  studio ? "text-white/70 hover:text-white" : "text-muted-foreground",
                  !studio && active && "bg-muted text-foreground",
                  studio && active && "bg-white/10 text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          {signedIn ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "text-sm whitespace-nowrap",
                  studio ? "text-white/70 hover:text-white" : "text-muted-foreground",
                )}
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className={cn(
                "text-sm",
                studio
                  ? "inline-flex h-8 items-center rounded-full border border-white/20 px-3 text-white hover:bg-white/10"
                  : "text-muted-foreground",
              )}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
