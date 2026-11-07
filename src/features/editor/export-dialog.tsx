"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { ExportBackground, ExportFormat, ExportRequest, ExportScale } from "@/features/editor/export-file";

type PreviewGround = "light" | "dark" | "checkerboard";

type ExportFile = {
  filename: string;
  blob: Blob;
};

const CHECKERBOARD = {
  backgroundColor: "#ececec",
  backgroundImage:
    "linear-gradient(45deg, #d7d7d7 25%, transparent 25%), linear-gradient(-45deg, #d7d7d7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d7d7d7 75%), linear-gradient(-45deg, transparent 75%, #d7d7d7 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
} as const;

function Segment({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-white/[0.06] p-1", className)} role="group">
      {children}
    </div>
  );
}

function Choice({
  active,
  children,
  onClick,
  disabled = false,
  grow = false,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-14 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-35",
        grow && "flex-1",
        active
          ? "bg-white text-[#1a1028] shadow-[0_8px_18px_-12px_rgba(196,181,253,0.95)]"
          : "text-white/70 hover:bg-white/8 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] tracking-[0.18em] text-white/45 uppercase">{label}</p>
      {children}
    </div>
  );
}

export function ExportDialog({
  projectId,
  projectName,
  onExport,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onExport: (request: ExportRequest) => Promise<ExportFile>;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("svg");
  const [scale, setScale] = useState<ExportScale>(1);
  const [background, setBackground] = useState<ExportBackground>("artboard");
  const [ground, setGround] = useState<PreviewGround>("light");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function requestFor(next: {
    format: ExportFormat;
    scale: ExportScale;
    background: ExportBackground;
  }): ExportRequest {
    return { projectName, ...next };
  }

  function loadPreview(next: { format: ExportFormat; scale: ExportScale; background: ExportBackground }) {
    const id = requestId.current + 1;
    requestId.current = id;
    setWaiting(true);
    setError(null);
    void onExport(requestFor(next))
      .then((file) => {
        if (requestId.current !== id) return;
        const url = URL.createObjectURL(file.blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        setPreviewUrl(url);
        setWaiting(false);
      })
      .catch(() => {
        if (requestId.current !== id) return;
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
        setPreviewUrl(null);
        setError("Export failed.");
        setWaiting(false);
      });
  }

  useEffect(() => {
    queueMicrotask(() => loadPreview({ format: "svg", scale: 1, background: "artboard" }));
    // The first preview uses the dialog's initial format, scale, and background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseFormat(next: ExportFormat) {
    setFormat(next);
    loadPreview({ format: next, scale, background });
  }

  function chooseScale(next: ExportScale) {
    setScale(next);
    loadPreview({ format, scale: next, background });
  }

  function chooseBackground(next: ExportBackground) {
    setBackground(next);
    loadPreview({ format, scale, background: next });
  }

  async function download() {
    const id = requestId.current + 1;
    requestId.current = id;
    setWaiting(true);
    setError(null);
    try {
      const file = await onExport(requestFor({ format, scale, background }));
      if (requestId.current !== id) return;
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      const body = new FormData();
      body.set("file", file.blob, file.filename);
      void fetch(`/api/projects/${projectId}/image`, { method: "POST", body });
      setWaiting(false);
    } catch {
      if (requestId.current !== id) return;
      setError("Export failed.");
      setWaiting(false);
    }
  }

  const groundStyle =
    ground === "dark"
      ? { backgroundColor: "#111111" }
      : ground === "checkerboard"
        ? CHECKERBOARD
        : { backgroundColor: "#ffffff" };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050214]/72 p-3 backdrop-blur-md sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        aria-busy={waiting}
        className="relative flex w-full max-w-[54rem] flex-col overflow-hidden rounded-[1.5rem] border border-white/12 bg-[linear-gradient(165deg,rgba(28,16,52,0.98)_0%,rgba(10,6,22,0.98)_100%)] text-white shadow-[0_40px_100px_-28px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-[#e9d5ff]/75 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 h-48 w-72 rounded-full bg-[#7c3aed]/28 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-40 w-40 rounded-full bg-[#ea580c]/16 blur-3xl"
        />

        <div className="relative flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-white/45 uppercase">Finish</p>
            <h2 id="export-title" className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
              Export your mark
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="relative grid items-start gap-5 px-4 pb-4 sm:gap-6 sm:px-5 sm:pb-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
          <section className="flex min-h-0 w-full flex-col items-start gap-2.5">
            <div className="flex w-full max-w-[min(100%,18rem)] flex-col gap-2.5 sm:max-w-[min(100%,20rem)]">
              <Field label="Preview">
                <Segment>
                  {(
                    [
                      ["light", "Light"],
                      ["dark", "Dark"],
                      ["checkerboard", "Check"],
                    ] as const
                  ).map(([id, name]) => (
                    <Choice key={id} active={ground === id} onClick={() => setGround(id)}>
                      {name}
                    </Choice>
                  ))}
                </Segment>
              </Field>
              <div
                className="flex w-full items-center justify-center overflow-hidden rounded-2xl p-4 sm:p-5"
                style={{ ...groundStyle, aspectRatio: "1 / 1" }}
              >
                {previewUrl ? (
                  // The blob is a local export of this artboard, not remote content.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-[#16141f]/50">Preparing preview…</p>
                )}
              </div>
            </div>
          </section>

          <section className="flex h-full flex-col gap-3.5">
            <Field label="Format">
              <Segment className="flex w-full">
                <Choice grow active={format === "svg"} onClick={() => chooseFormat("svg")}>
                  SVG
                </Choice>
                <Choice grow active={format === "png"} onClick={() => chooseFormat("png")}>
                  PNG
                </Choice>
              </Segment>
            </Field>

            {format === "png" ? (
              <Field label="PNG scale">
                <Segment className="flex w-full">
                  <Choice grow active={scale === 1} onClick={() => chooseScale(1)}>
                    1×
                  </Choice>
                  <Choice grow active={scale === 2} onClick={() => chooseScale(2)}>
                    2×
                  </Choice>
                </Segment>
              </Field>
            ) : null}

            <Field label="Background">
              <Segment className="flex w-full">
                <Choice grow active={background === "artboard"} onClick={() => chooseBackground("artboard")}>
                  Artboard
                </Choice>
                <Choice
                  grow
                  active={background === "transparent"}
                  onClick={() => chooseBackground("transparent")}
                >
                  Transparent
                </Choice>
              </Segment>
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-[#fda4af]">
                {error}
              </p>
            ) : null}

            <div className="mt-auto flex flex-col gap-3 py-2">
              <div
                aria-hidden="true"
                className="h-px w-16 bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74]"
              />
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase">
                <span className="text-[#67e8f9]">Create.</span>{" "}
                <span className="text-[#d8b4fe]">Design.</span>{" "}
                <span className="text-[#fdba74]">Inspire.</span>
              </p>
              <p className="max-w-[16rem] text-sm leading-relaxed text-white/70">
                Vezora keeps the living mark — export the file, reopen the craft.
              </p>
              <p className="home-shimmer max-w-[16rem] bg-gradient-to-r from-[#67e8f9] via-[#d8b4fe] to-[#fdba74] bg-clip-text text-sm font-medium text-transparent">
                One studio. Endless revisions. A logo that never goes flat.
              </p>
            </div>

            <Button
              type="button"
              disabled={waiting}
              className="home-cta h-11 w-full rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03]"
              onClick={() => void download()}
            >
              {waiting ? "Preparing…" : "Download"}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
