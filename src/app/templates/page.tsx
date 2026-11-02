import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { auth } from "@/lib/auth";
import { DesignPreview } from "@/features/projects/design-preview";
import { templateCategories } from "@/features/templates/catalog";
import { useTemplate } from "@/features/templates/actions";
import { categoryFromQuery, listPublishedTemplates } from "@/features/templates/store";

export const metadata = {
  title: "Templates — Vezora",
  description: "Start from a published Vezora template. It opens as your own logo.",
};

const searchField =
  "h-11 rounded-full border-[#e6e4ee] bg-white px-4 text-[#16141f] shadow-none focus-visible:border-[#6d5bd0] focus-visible:ring-[#6d5bd0]/25";

const primary = "h-10 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]";
const quiet = "h-9 rounded-full border-[#d9d6e3] bg-white px-3.5 text-[#16141f] hover:bg-[#f4f2ec]";
const chipOn = "h-9 rounded-full bg-[#16141f] px-3.5 text-white hover:bg-[#2a2640]";

export default function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; query?: string | string[]; error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="bg-[#f5f6f8] px-4 py-10 text-sm text-[#16141f]/60">Loading templates…</p>}>
      <TemplateGallery searchParams={searchParams} />
    </Suspense>
  );
}

async function TemplateGallery({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; query?: string | string[]; error?: string | string[] }>;
}) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const params = await searchParams;
  const selected = typeof params.category === "string" ? params.category : "All";
  const term = typeof params.query === "string" ? params.query.trim() : "";
  const failedToCopy = params.error === "missing";
  let failed = false;
  let templates: Awaited<ReturnType<typeof listPublishedTemplates>> = [];
  try {
    templates = await listPublishedTemplates(categoryFromQuery(selected), term);
  } catch {
    failed = true;
  }
  const retryHref = templateHref(selected, term);
  const countLabel = `${templates.length} ${templates.length === 1 ? "template" : "templates"}`;

  return (
    <main className="flex-1 bg-[#f5f6f8] text-[#16141f]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#6d5bd0] uppercase">Templates</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Start from a mark.</h1>
            <p className="mt-2 max-w-xl text-sm text-[#16141f]/60">
              {failed
                ? "The catalog could not be read."
                : `${countLabel}. Using one copies it into your account. The original stays unchanged.`}
            </p>
          </div>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), quiet, "h-10 px-4")}>
            Your logos
          </Link>
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {["All", ...templateCategories].map((item) => (
              <Link
                key={item}
                href={templateHref(item, term)}
                aria-current={selected === item ? "true" : undefined}
                className={cn(buttonVariants({ variant: selected === item ? "default" : "outline" }), selected === item ? chipOn : quiet)}
              >
                {item}
              </Link>
            ))}
          </div>
          <form className="flex w-full max-w-xl gap-2" action="/templates">
            {selected !== "All" ? <input type="hidden" name="category" value={selected} /> : null}
            <Input
              name="query"
              defaultValue={term}
              placeholder="Search by name"
              aria-label="Search templates"
              className={searchField}
            />
            <button className={cn(buttonVariants({ variant: "outline" }), quiet, "h-11 px-4")} type="submit">
              Search
            </button>
          </form>
        </div>

        {failedToCopy ? (
          <p className="text-sm text-[#9f1239]">That template was not found.</p>
        ) : null}

        {failed ? (
          <EmptyPanel title="Could not load templates.">
            <Link href={retryHref} className={cn(buttonVariants(), primary)}>
              Retry
            </Link>
          </EmptyPanel>
        ) : templates.length === 0 ? (
          <EmptyPanel title={term ? "No templates match." : "No templates in this category."}>
            <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }), quiet, "h-10 px-4")}>
              Show all
            </Link>
          </EmptyPanel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <article
                key={template.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#e6e4ee] bg-white shadow-[0_10px_30px_rgba(22,20,31,0.04)]"
              >
                <DesignPreview document={template.document} label={template.name} framed />
                <div className="flex flex-1 flex-col px-4 py-3.5">
                  <p className="text-xs tracking-[0.14em] text-[#6d5bd0] uppercase">{template.category}</p>
                  <h2 className="mt-1 font-medium">{template.name}</h2>
                  <p className="mt-1 flex-1 text-sm text-[#16141f]/60">{template.description}</p>
                  <form action={useTemplate} className="mt-4">
                    <input type="hidden" name="templateId" value={template.id} />
                    <SubmitButton idle="Use template" pending="Opening…" className={primary} />
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#d9d6e3] bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-6 flex justify-center">{children}</div>
    </div>
  );
}

function templateHref(category: string, query: string) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (query) params.set("query", query);
  const search = params.toString();
  return search ? `/templates?${search}` : "/templates";
}
