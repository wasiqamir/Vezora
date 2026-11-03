import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { startProject } from "@/features/account/actions";
import { ProjectCard } from "@/features/projects/project-card";
import { listProjectPreviews } from "@/features/projects/store";

export const metadata = {
  title: "Dashboard — Vezora",
  description: "Open, search, and start the logos saved to your Vezora account.",
};

const searchField =
  "h-11 rounded-full border-[#e6e4ee] bg-white px-4 text-[#16141f] shadow-none focus-visible:border-[#6d5bd0] focus-visible:ring-[#6d5bd0]/25";

const primary =
  "h-10 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]";

const quiet =
  "h-10 rounded-full border-[#d9d6e3] bg-white px-4 text-[#16141f] hover:bg-[#f4f2ec]";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  return (
    <Suspense fallback={<p className="bg-[#f5f6f8] px-4 py-10 text-sm text-[#16141f]/60">Loading projects…</p>}>
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
  const firstName = session.user.name?.trim().split(/\s+/)[0];
  let projects: {
    id: string;
    name: string;
    updatedAt: Date;
    imageUrl: string | null;
    previewSvg: string;
    width: number;
    height: number;
  }[] = [];
  let failed = false;
  try {
    projects = await listProjectPreviews(session.user.id, query);
  } catch {
    failed = true;
  }

  const countLabel = query
    ? `${projects.length} ${projects.length === 1 ? "match" : "matches"}`
    : `${projects.length} ${projects.length === 1 ? "logo" : "logos"}`;

  return (
    <main className="flex-1 bg-[#f5f6f8] text-[#16141f]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {firstName ? `${firstName}, your logos.` : "Your logos."}
            </h1>
            <p className="mt-2 text-sm text-[#16141f]/60">
              {failed ? "The library could not be read." : `${countLabel}. Open one, or start a blank mark.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }), quiet)}>
              Templates
            </Link>
            <form action={startProject}>
              <Button type="submit" className={primary}>
                New logo
              </Button>
            </form>
          </div>
        </header>

        <form className="flex w-full max-w-xl gap-2" action="/dashboard">
          <Input
            name="query"
            defaultValue={query}
            aria-label="Search projects"
            placeholder="Search by name"
            className={searchField}
          />
          <Button type="submit" variant="outline" className={quiet}>
            Search
          </Button>
        </form>

        {failed ? (
          <EmptyPanel title="Could not load projects.">
            <Link
              href={query ? `/dashboard?query=${encodeURIComponent(query)}` : "/dashboard"}
              className={cn(buttonVariants(), primary)}
            >
              Retry
            </Link>
          </EmptyPanel>
        ) : projects.length === 0 && query.length === 0 ? (
          <EmptyPanel
            title="No logos yet."
            copy="Start a blank logo. It stays on this account when you leave the editor."
          >
            <form action={startProject}>
              <Button type="submit" className={primary}>
                Start blank
              </Button>
            </form>
            <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }), quiet)}>
              Browse templates
            </Link>
          </EmptyPanel>
        ) : projects.length === 0 ? (
          <EmptyPanel title="No projects match that name.">
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), quiet)}>
              Clear search
            </Link>
          </EmptyPanel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={{
                  id: project.id,
                  name: project.name,
                  updatedAt: project.updatedAt.toISOString(),
                  imageUrl: project.imageUrl,
                  previewSvg: project.previewSvg,
                  width: project.width,
                  height: project.height,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyPanel({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[#d9d6e3] bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      {copy ? <p className="mx-auto mt-2 max-w-md text-sm text-[#16141f]/60">{copy}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}
