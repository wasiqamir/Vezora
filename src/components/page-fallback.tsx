/** Silent Suspense fallback so route changes do not flash "Loading…" text. */
export function PageFallback({
  tone = "dark",
  full = false,
}: {
  tone?: "light" | "dark" | "muted";
  full?: boolean;
}) {
  const background =
    tone === "light" ? "bg-[#f5f6f8]" : "bg-[#07041c]";

  return (
    <main
      className={
        full
          ? `fixed inset-0 z-40 ${background}`
          : `min-h-[calc(100dvh-4.8125rem)] flex-1 ${background}`
      }
      aria-hidden="true"
    />
  );
}
