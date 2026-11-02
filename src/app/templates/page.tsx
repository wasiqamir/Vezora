import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { templateCategories } from "@/features/templates/catalog";
import { useTemplate } from "@/features/templates/actions";
import { templatePreviewSvg } from "@/features/templates/preview";
import { categoryFromQuery, listPublishedTemplates } from "@/features/templates/store";

export default function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; query?: string | string[]; error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading templates…</p>}>
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose a starter. It opens as your own project, and the original template stays unchanged.
          </p>
        </div>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {["All", ...templateCategories].map((item) => (
          <Link
            key={item}
            href={templateHref(item, term)}
            className={buttonVariants({ variant: selected === item ? "default" : "outline" })}
          >
            {item}
          </Link>
        ))}
      </div>
      <form className="flex max-w-md gap-2" action="/templates">
        {selected !== "All" ? <input type="hidden" name="category" value={selected} /> : null}
        <Input name="query" defaultValue={term} placeholder="Search templates" aria-label="Search templates" />
        <button className={buttonVariants({ variant: "outline" })} type="submit">
          Search
        </button>
      </form>
      {failedToCopy ? <p className="text-sm text-destructive">That template was not found.</p> : null}
      {failed ? (
        <div className="rounded-xl border px-6 py-16 text-center">
          <h2 className="text-lg font-medium">Could not load templates.</h2>
          <Link href={retryHref} className={buttonVariants({ className: "mt-4" })}>
            Retry
          </Link>
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {term ? "No templates match." : "No templates in this category."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <article key={template.id} className="flex flex-col gap-3 rounded-xl border p-3">
              <div
                className="overflow-hidden rounded-lg border"
                style={{ aspectRatio: `${template.document.artboard.width} / ${template.document.artboard.height}` }}
                dangerouslySetInnerHTML={{ __html: templatePreviewSvg(template.document) }}
              />
              <div>
                <h2 className="font-medium">{template.name}</h2>
                <p className="text-sm text-muted-foreground">{template.category}</p>
                <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
              </div>
              <form action={useTemplate}>
                <input type="hidden" name="templateId" value={template.id} />
                <Button type="submit">Use template</Button>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function templateHref(category: string, query: string) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (query) params.set("query", query);
  const search = params.toString();
  return search ? `/templates?${search}` : "/templates";
}
