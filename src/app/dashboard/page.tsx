import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startProject } from "@/features/account/actions";
import { ProjectCard } from "@/features/projects/project-card";
import { listProjectPreviews } from "@/features/projects/store";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading projects…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  let projects: { id: string; name: string; updatedAt: Date; previewSvg: string; width: number; height: number }[] = [];
  let failed = false;
  try {
    projects = await listProjectPreviews(session.user.id, query);
  } catch {
    failed = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/templates" className={buttonVariants({ variant: "outline" })}>
            Templates
          </Link>
          <form action={startProject}>
            <Button type="submit">New logo</Button>
          </form>
        </div>
      </div>
      <form className="flex max-w-md gap-2" action="/dashboard">
        <Input name="query" defaultValue={query} aria-label="Search projects" placeholder="Search projects" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {failed ? (
        <div className="rounded-xl border px-6 py-16 text-center">
          <h2 className="text-lg font-medium">Could not load projects.</h2>
          <Link href={query ? `/dashboard?query=${encodeURIComponent(query)}` : "/dashboard"} className={buttonVariants({ className: "mt-4" })}>
            Retry
          </Link>
        </div>
      ) : projects.length === 0 && query.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-lg font-medium">No logos yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start a blank logo. It stays on this account when you leave the editor.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <form action={startProject}>
              <Button type="submit">Start blank</Button>
            </form>
            <Link href="/templates" className={buttonVariants({ variant: "outline" })}>
              Browse templates
            </Link>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-lg font-medium">No projects match that name.</h2>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Clear search
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                id: project.id,
                name: project.name,
                updatedAt: project.updatedAt.toISOString(),
                previewSvg: project.previewSvg,
                width: project.width,
                height: project.height,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
