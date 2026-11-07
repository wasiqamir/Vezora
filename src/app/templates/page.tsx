import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cn } from "cn";
import { PageFallback } from "@/components/page-fallback";
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
  "h-11 rounded-full border-white/12 bg-white/[0.04] px-4 text-white shadow-none placeholder:text-white/35 focus-visible:border-[#c4b5fd]/55 focus-visible:ring-[#c4b5fd]/20";

const primary =
  "home-cta h-10 w-full rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-4 text-sm font-medium text-[#1a1028] shadow-[0_12px_28px_-12px_rgba(167,139,250,0.85),0_8px_16px_-12px_rgba(251,146,60,0.45)] hover:brightness-[1.03]";

const quiet =
  "h-9 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-white/85 hover:bg-white/10 hover:text-white";

const chipOn =
  "h-9 rounded-full border border-white/20 bg-white/16 px-3.5 text-white shadow-[0_12px_26px_-12px_rgba(196,181,253,0.9),inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white/20";

export default function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; query?: string | string[]; error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<PageFallback tone="dark" />}>
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
  const signedIn = Boolean(session?.user?.id);
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
    <main className="relative flex-1 overflow-hidden bg-[#07041c] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="home-glow absolute -top-28 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/35 blur-3xl" />
        <div className="home-glow-delay home-float-slow absolute top-40 -right-16 h-64 w-64 rounded-full bg-[#2563eb]/25 blur-3xl" />
        <div className="home-float absolute bottom-10 -left-20 h-56 w-72 rounded-full bg-[#c2410c]/16 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:py-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">Templates</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start from a mark.
            </h1>
            <p className="home-shimmer mt-2 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-sm font-medium text-transparent">
              Create. Design. Inspire.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
              {failed
                ? "The catalog could not be read."
                : signedIn
                  ? `${countLabel}. Using one copies it into your account. The original stays unchanged.`
                  : `${countLabel}. Open any mark on the artboard right away. Sign in later to keep it in your account.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {signedIn ? (
              <Link href="/account" className={cn(buttonVariants({ variant: "outline" }), quiet, "h-10 px-4")}>
                Your logos
              </Link>
            ) : null}
            <Link
              href="/editor/new"
              className={cn(
                buttonVariants(),
                "home-cta h-10 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-5 text-sm font-medium text-[#1a1028] shadow-[0_12px_28px_-12px_rgba(167,139,250,0.85),0_8px_16px_-12px_rgba(251,146,60,0.45)] hover:brightness-[1.03]",
              )}
            >
              Create own Logo
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {["All", ...templateCategories].map((item) => (
              <Link
                key={item}
                href={templateHref(item, term)}
                aria-current={selected === item ? "true" : undefined}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  selected === item ? chipOn : quiet,
                )}
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
          <p className="text-sm text-[#fda4af]">That template was not found.</p>
        ) : null}

        {failed ? (
          <EmptyPanel title="Could not load templates.">
            <Link href={retryHref} className={cn(buttonVariants(), primary, "w-auto px-5")}>
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {templates.map((template) => (
              <article
                key={template.id}
                className="template-card group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(165deg,rgba(255,255,255,0.07)_0%,rgba(16,8,24,0.92)_42%,rgba(10,5,18,0.96)_100%)] shadow-[0_28px_70px_-28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e9d5ff]/70 to-transparent opacity-80"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-16 right-0 h-36 w-36 rounded-full bg-[#7c3aed]/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />

                <div className="relative p-3.5 pb-0 sm:p-4 sm:pb-0">
                  <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0a0614] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(167,139,250,0.16),transparent_55%)]"
                    />
                    <div className="relative flex aspect-[5/4] items-center justify-center p-5 sm:p-6">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1rem] bg-[#f7f3ec] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <DesignPreview
                          document={template.document}
                          label={template.name}
                          framed
                          frameClassName="h-full w-full bg-transparent px-5 py-4"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-1 flex-col px-5 pt-4 pb-5 sm:px-5 sm:pb-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] tracking-[0.22em] text-[#d8b4fe]/90 uppercase">{template.category}</p>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-gradient-to-r from-[#d8b4fe]/35 to-transparent"
                    />
                  </div>
                  <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-white">{template.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-white/58">{template.description}</p>
                  {signedIn ? (
                    <form action={useTemplate} className="mt-5">
                      <input type="hidden" name="templateId" value={template.id} />
                      <SubmitButton idle="Use template" pending="Opening…" className={primary} />
                    </form>
                  ) : (
                    <Link
                      href={`/editor/try/${encodeURIComponent(template.slug)}`}
                      prefetch
                      className={cn(buttonVariants(), primary, "mt-5 inline-flex")}
                    >
                      Use template
                    </Link>
                  )}
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
    <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
      <h2 className="text-lg font-medium text-white">{title}</h2>
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
