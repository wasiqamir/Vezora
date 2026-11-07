import Image from "next/image";
import Link from "next/link";
import { HomeReveal } from "@/components/home-reveal";
import { VezoraMark } from "@/components/vezora-mark";

export const metadata = {
  title: "Vezora — Create. Design. Inspire.",
  description: "A logo studio for marks you can reopen, edit, and export as SVG or PNG.",
};

const toolGlyphs = [
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 2.5 12 7.2l-4 .7-.2 4.2z"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 13.2 11.6 4.6l1 1L4 14.2z"/><path d="m10.8 3.8 1.4-1.4 1.6 1.6-1.4 1.4"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 3.5h5.2a2.6 2.6 0 0 1 0 5.2H4zM4 8.7h6.2"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="4.2"/></svg>`,
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.2"/></svg>`,
];

const steps = [
  {
    word: "Create.",
    color: "text-[#67e8f9]",
    line: "from-[#67e8f9]",
    title: "Open a blank board",
    copy: "Drop in type, draw paths, and place icons without locking the mark into a flat picture.",
    detail: "Wordmarks, monograms, and emblems begin as editable objects you can keep moving.",
  },
  {
    word: "Design.",
    color: "text-[#d8b4fe]",
    line: "from-[#d8b4fe]",
    title: "Shape the identity",
    copy: "Adjust weight, spacing, fill, and arrangement until the mark feels deliberate.",
    detail: "Layers stay separate, so one change never forces you to redraw the whole logo.",
  },
  {
    word: "Inspire.",
    color: "text-[#fdba74]",
    line: "from-[#fdba74]",
    title: "Ship and return",
    copy: "Export SVG or PNG for use today, then reopen the same project tomorrow.",
    detail: "The finished file is a snapshot. The studio keeps the living version.",
  },
];

const studioPoints = [
  {
    label: "Vector layers",
    copy: "Text, paths, and icons stay as objects, not a flattened picture you cannot reopen.",
  },
  {
    label: "Artboard control",
    copy: "Set size and background for the mark you are building, then export at the scale you need.",
  },
  {
    label: "Saved history",
    copy: "Each save stays with your account, so earlier versions remain easy to revisit.",
  },
];

const exports = [
  {
    format: "SVG",
    copy: "Crisp vectors for websites, print files, and work that needs to scale without blur.",
  },
  {
    format: "PNG",
    copy: "Ready-to-share images for decks, social posts, and places that want a fixed picture.",
  },
];

const templateKinds = [
  "Wordmarks for clean named brands",
  "Monograms that lead with initials",
  "Local marks for shops and studios",
  "Layouts you can rewrite in minutes",
];

const testimonials = [
  {
    quote:
      "I stopped rebuilding logos from old PNGs. In Vezora the mark stays editable, so a name change takes minutes instead of a full redraw.",
    name: "Amina R.",
    role: "Freelance brand designer",
  },
  {
    quote:
      "Our shop mark finally lives in one place. I can open it, tweak the spacing, export SVG for the site, and keep moving.",
    name: "Jonah K.",
    role: "Founder, local studio",
  },
  {
    quote:
      "Templates got me past the blank board. The real win is coming back later and finding every layer still intact.",
    name: "Priya S.",
    role: "Product marketer",
  },
];

const makers = [
  {
    title: "Founders shaping a first mark",
    copy: "Start from a blank board or a starter, then keep refining as the brand settles into its voice.",
  },
  {
    title: "Designers who need living files",
    copy: "Hand clients SVG and PNG, while the editable project stays ready for the next revision round.",
  },
  {
    title: "Shops and studios with a fixed identity",
    copy: "Hold one logo, reopen it for seasonal tweaks, and export clean files without starting over.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#07041c] text-white">
      <section className="relative flex min-h-[calc(100dvh-4.8125rem)] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="home-glow absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-[#5b21b6]/40 blur-3xl" />
          <div className="home-glow-delay home-float-slow absolute top-24 -right-20 h-72 w-72 rounded-full bg-[#2563eb]/30 blur-3xl" />
          <div className="home-float absolute bottom-0 -left-16 h-64 w-80 rounded-full bg-[#c2410c]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-14">
          <div className="home-hero-copy flex min-w-0 flex-col items-start">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/75">
              <span className="home-mark-pulse inline-flex rounded-full">
                <VezoraMark className="h-4 w-6" />
              </span>
              Logo studio
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Design a mark you can reopen.
            </h1>
            <p className="home-shimmer mt-3 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-lg font-medium text-transparent">
              Create. Design. Inspire.
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/70">
              Vezora is a vector workspace for wordmarks, icons, and layouts. Draw on an artboard, keep every layer,
              and export SVG or PNG when the identity is ready.
            </p>
            <div className="mt-6">
              <Link
                href="/templates"
                className="home-cta inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Browse templates
              </Link>
            </div>
          </div>
          <EditorPreview />
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/8 py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_40%,rgba(124,58,237,0.22),transparent_62%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-12 px-4 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <HomeReveal from="left">
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">The studio</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              An artboard built for marks that stay editable.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/65">
              Paths, type, and icons live as real layers. Come back tomorrow and the drawing is still yours to
              move, scale, and refine. Vezora keeps the working file with your account, not only the exported picture.
            </p>
            <div className="mt-8 space-y-5">
              {studioPoints.map((point) => (
                <div key={point.label} className="border-l border-white/15 pl-4 transition-colors hover:border-[#c4b5fd]">
                  <p className="text-sm font-semibold tracking-wide text-white">{point.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{point.copy}</p>
                </div>
              ))}
            </div>
            <div className="home-line mt-10 h-px w-40 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74]" />
          </HomeReveal>
          <HomeReveal delay={120} from="right">
            <div className="home-card relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#100818] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[5/4]">
                <Image
                  src="/vezora-studio-mark.jpg"
                  alt="Emerald botanical monogram on a violet and gold studio field"
                  fill
                  sizes="(min-width: 1024px) 32rem, 100vw"
                  className="home-ken object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07041c]/85 via-[#07041c]/15 to-transparent" />
                <div className="absolute right-5 bottom-5 left-5">
                  <p className="text-xs tracking-[0.22em] text-white/55 uppercase">Workspace</p>
                  <p className="mt-2 text-base font-medium text-white">
                    Draw once. Keep the layers. Return whenever the mark needs another pass.
                  </p>
                </div>
              </div>
            </div>
          </HomeReveal>
        </div>
      </section>

      <section className="relative border-t border-white/8 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4">
          <HomeReveal>
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">The rhythm</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Three words. One clear path from blank board to finished file.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
              Vezora follows the same beat as the brand itself. Create the first composition, design until it feels
              owned, then inspire use with a file you can still reopen.
            </p>
          </HomeReveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-7">
            {steps.map((step, index) => (
              <HomeReveal
                key={step.word}
                delay={index * 140}
                from="scale"
                className="home-card rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <p className={`text-4xl font-semibold tracking-tight sm:text-5xl ${step.color}`}>{step.word}</p>
                <div className={`home-line mt-4 h-px w-16 bg-gradient-to-r ${step.line} to-transparent`} />
                <p className="mt-5 text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{step.copy}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/45">{step.detail}</p>
              </HomeReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/8 py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_40%,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(251,146,60,0.12),transparent_42%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
          <HomeReveal from="left">
            <div className="home-card overflow-hidden rounded-[2rem] border border-white/10 bg-[#100818] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.3)] sm:p-10">
              <span className="home-float inline-block">
                <VezoraMark className="h-16 w-24" />
              </span>
              <p className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Export the picture. Keep the project.</p>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                A logo is more than one download. Vezora stores the editable design so you can change a letter, swap a
                color, or resize the artboard without rebuilding from a PNG.
              </p>
            </div>
          </HomeReveal>
          <HomeReveal delay={120} from="right">
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">Export</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Two formats when the mark is ready to leave the studio.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
              Choose the file that fits the moment. The studio still holds the living version for the next edit.
            </p>
            <div className="mt-8 space-y-6">
              {exports.map((item) => (
                <div key={item.format} className="flex gap-5 border-t border-white/10 pt-5">
                  <p className="w-16 shrink-0 text-lg font-semibold tracking-[0.18em] text-[#d8b4fe]">{item.format}</p>
                  <p className="text-sm leading-relaxed text-white/65">{item.copy}</p>
                </div>
              ))}
            </div>
          </HomeReveal>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/8 py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(234,88,12,0.14),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(56,189,248,0.12),transparent_40%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <HomeReveal>
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">Templates</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start from a starter, then make it unmistakably yours.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
              Open a template for a wordmark, monogram, or local mark. Every piece stays editable so the first draft is
              never the last word. Rewrite the name, restyle the mark, and keep building on the same board.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {templateKinds.map((kind) => (
                <li key={kind} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                  {kind}
                </li>
              ))}
            </ul>
            <Link
              href="/templates"
              className="home-cta home-cta-glow mt-8 inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-[#14081f] shadow-[0_16px_40px_-16px_rgba(196,181,253,0.85)]"
            >
              Browse templates
            </Link>
          </HomeReveal>
          <HomeReveal delay={100} from="scale">
            <div className="home-card relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#100818] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
              <div className="relative mx-auto aspect-square max-w-[20rem] overflow-hidden rounded-[1.5rem]">
                <Image
                  src="/vezora-template-floral.jpg"
                  alt="Ornamental floral emblem design"
                  fill
                  sizes="20rem"
                  className="home-ken object-cover"
                />
              </div>
              <p className="mt-6 text-center text-sm leading-relaxed text-white/60">
                Starters give you structure. Your edits give the mark its voice.
              </p>
            </div>
          </HomeReveal>
        </div>
      </section>

      <section className="relative border-t border-white/8 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4">
          <HomeReveal>
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">Voices</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Marks that stay with the people who make them.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
              Designers, founders, and small studios use Vezora when a logo needs to grow with the brand instead of
              freezing as a single export.
            </p>
          </HomeReveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item, index) => (
              <HomeReveal
                key={item.name}
                delay={index * 120}
                from="scale"
                className="home-card flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-4xl leading-none text-[#d8b4fe]">“</p>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{item.quote}</p>
                <div className="mt-auto pt-8">
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-xs tracking-wide text-white/45">{item.role}</p>
                </div>
              </HomeReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/8 py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(124,58,237,0.16),transparent_45%)]"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4">
          <HomeReveal>
            <p className="text-xs tracking-[0.28em] text-white/45 uppercase">Made for</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Built for people who will reopen the logo again.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
              Whether you are naming a first company or refining a mark you already love, Vezora keeps the working
              file close and the exports ready when you need them.
            </p>
          </HomeReveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {makers.map((item, index) => (
              <HomeReveal key={item.title} delay={index * 120} className="home-card rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
                <p className="text-sm font-semibold tracking-[0.18em] text-[#67e8f9]">0{index + 1}</p>
                <p className="mt-4 text-xl font-semibold tracking-tight text-white">{item.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{item.copy}</p>
              </HomeReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/8 py-24 sm:py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="home-glow absolute top-1/2 left-1/2 h-72 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5b21b6]/35 blur-3xl" />
          <div className="home-glow-delay home-float-slow absolute top-10 right-[12%] h-48 w-48 rounded-full bg-[#2563eb]/25 blur-3xl" />
          <div className="home-float absolute bottom-6 left-[10%] h-40 w-56 rounded-full bg-[#c2410c]/18 blur-3xl" />
        </div>
        <HomeReveal from="scale" className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center">
          <div className="flex w-full max-w-xl items-center gap-4">
            <span
              aria-hidden="true"
              className="home-line h-px min-w-0 flex-1 bg-gradient-to-r from-transparent via-[#67e8f9]/80 to-[#d8b4fe]"
            />
            <p className="home-shimmer shrink-0 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-sm font-semibold tracking-[0.22em] text-transparent uppercase sm:text-[0.95rem]">
              Create. Design. Inspire.
            </p>
            <span
              aria-hidden="true"
              className="home-line h-px min-w-0 flex-1 origin-right bg-gradient-to-l from-transparent via-[#fdba74]/80 to-[#d8b4fe]"
            />
          </div>
          <span className="home-float home-mark-pulse mt-8 inline-flex">
            <span className="relative inline-flex">
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a78bfa]/40 blur-xl"
              />
              <VezoraMark className="relative h-16 w-24 drop-shadow-[0_12px_28px_rgba(124,58,237,0.45)]" />
            </span>
          </span>
          <h2 className="mt-7 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your next logo should outlive one export.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/65">
            Draw it once. Reopen it later. Carry the same identity from screen to file without starting over.
          </p>
          <div className="mt-9">
            <Link
              href="/sign-up"
              className="home-cta home-cta-glow inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-7 text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)]"
            >
              Create an account
            </Link>
          </div>
        </HomeReveal>
      </section>
    </main>
  );
}

function EditorPreview() {
  return (
    <div className="home-preview rounded-3xl border border-white/10 bg-[#120a22] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="size-2.5 rounded-full bg-[#fb7185]" />
          <i className="size-2.5 rounded-full bg-[#fbbf24]" />
          <i className="size-2.5 rounded-full bg-[#34d399]" />
        </span>
        <p className="text-xs text-white/70">Untitled logo</p>
        <p className="ml-auto text-[10px] tracking-wide text-white/40">SVG · PNG</p>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
        <div className="grid content-start gap-1.5" aria-hidden="true">
          {toolGlyphs.map((glyph) => (
            <span
              key={glyph}
              className="grid h-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/25 hover:bg-white/10"
              dangerouslySetInnerHTML={{ __html: glyph }}
            />
          ))}
        </div>
        <div className="relative aspect-[4/3] max-h-[min(22rem,42dvh)] min-w-0 overflow-hidden rounded-2xl lg:max-h-[min(28rem,calc(100dvh-16rem))]">
          <Image
            src="/vezora-canvas.jpg"
            alt="Emerald mark on a violet and gold field"
            fill
            priority
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="home-ken object-cover"
          />
        </div>
      </div>
    </div>
  );
}
