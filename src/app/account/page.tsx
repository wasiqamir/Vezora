import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { auth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { startProject } from "@/features/account/actions";
import { DesignPreview } from "@/features/projects/design-preview";
import { listAccountDesigns } from "@/features/projects/store";

export const metadata = {
  title: "Account — Vezora",
  description: "The logos and saved history on your Vezora account.",
};

const primary = "h-10 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]";
const quiet = "h-10 rounded-full border-[#d9d6e3] bg-white px-4 text-[#16141f] hover:bg-[#f4f2ec]";

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="bg-[#f5f6f8] px-4 py-10 text-sm text-[#16141f]/60">Loading your account…</p>}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const designs = await listAccountDesigns(session.user.id);
  const name = session.user.name?.trim() || "Your account";

  return (
    <main className="flex-1 bg-[#f5f6f8] text-[#16141f]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#6d5bd0] uppercase">Account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-2 max-w-xl text-sm text-[#16141f]/60">
              {session.user.email ? `${session.user.email}. ` : ""}
              These designs and their saved history belong only to this account.
            </p>
          </div>
          <form action={startProject}>
            <Button type="submit" className={primary}>
              New logo
            </Button>
          </form>
        </header>

        {designs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d9d6e3] bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-medium">No designs yet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#16141f]/60">
              Start a logo. It stays here, with each save, so you can open it again later.
            </p>
            <form action={startProject} className="mt-6">
              <Button type="submit" className={primary}>
                Start blank
              </Button>
            </form>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((design) => (
              <article
                key={design.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#e6e4ee] bg-white shadow-[0_10px_30px_rgba(22,20,31,0.04)]"
              >
                <DesignPreview document={design.document} imageUrl={design.imageUrl} label={design.name} framed />
                <div className="flex flex-1 flex-col px-4 py-3.5">
                  <h2 className="font-medium">{design.name}</h2>
                  <p className="mt-1 text-xs text-[#16141f]/50">
                    {design.saves === 1 ? "1 save" : `${design.saves} saves`}
                    {design.shared ? " · Shared" : ""}
                    {" · "}
                    Edited {formatWhen(design.updatedAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/editor/${design.id}`} className={cn(buttonVariants(), primary)}>
                      Edit
                    </Link>
                    <Link
                      href={`/account/${design.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), quiet)}
                    >
                      History
                    </Link>
                  </div>
                </div>
              </article>
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
