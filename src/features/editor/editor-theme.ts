/** Shared homepage-aligned studio chrome for the editor. */
export const editorQuiet =
  "h-9 shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 text-white/85 hover:bg-white/10 hover:text-white";

export const editorPrimary =
  "h-9 shrink-0 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-4 text-sm font-medium text-[#1a1028] shadow-[0_12px_28px_-12px_rgba(167,139,250,0.75),0_8px_16px_-12px_rgba(251,146,60,0.4)] hover:brightness-[1.03]";

export const editorPanel =
  "border-white/10 bg-[#100818]/95 text-white backdrop-blur-xl";

export const editorField =
  "rounded-lg border-white/12 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-[#c4b5fd]/55 focus-visible:ring-[#c4b5fd]/20";

export const editorMuted = "text-white/55";

export const editorLabel = "text-[#d8b4fe]";

export const editorStage = {
  backgroundColor: "#0a0614",
  backgroundImage:
    "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)",
  backgroundSize: "24px 24px",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
} as const;
