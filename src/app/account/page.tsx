import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { startProject } from "@/features/account/actions";
import { Button } from "@/components/ui/button";
import { DesignPreview } from "@/features/projects/design-preview";
import { listAccountDesigns } from "@/features/projects/store";

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading your account…</p>}>
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {session.user.email ? `${session.user.email}. ` : ""}
            These designs and their saved history belong only to this account.
          </p>
        </div>
        <form action={startProject}>
          <Button type="submit">New logo</Button>
        </form>
      </div>
      {designs.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-lg font-medium">No designs yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start a logo. It stays here, with each save, so you can open it again later.
          </p>
          <form action={startProject} className="mt-6">
            <Button type="submit">Start blank</Button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((design) => (
            <article key={design.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <DesignPreview document={design.document} label={design.name} />
              <div className="flex flex-col gap-1">
                <h2 className="font-medium">{design.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {design.saves === 1 ? "1 save" : `${design.saves} saves`}
                  {design.shared ? " · Shared" : ""}
                  {" · "}
                  Edited {formatWhen(design.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/account/${design.id}`} className={buttonVariants({ variant: "outline" })}>
                  History
                </Link>
                <Link href={`/editor/${design.id}`} className={buttonVariants()}>
                  Edit
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
