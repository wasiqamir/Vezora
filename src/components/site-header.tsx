"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { signOutAction } from "@/features/account/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Account" },
  { href: "/templates", label: "Templates" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/vezora-logo.png"
            alt="Vezora. Create. Design. Define Your Identity."
            width={160}
            height={53}
            priority
            className="h-10 w-auto"
            style={{ width: "auto", height: "2.5rem" }}
          />
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
                  "rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground",
                  active && "bg-muted text-foreground",
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
              <button type="submit" className="text-sm text-muted-foreground">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/sign-in" className="text-sm text-muted-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
