"use client";

import { useEffect, useRef, useState } from "react";
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        aria-busy={waiting}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-4 shadow-lg"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center gap-3">
          <h2 id="export-title" className="text-base font-medium">
            Export
          </h2>
          <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-4 text-sm">
          <legend className="mr-2 text-muted-foreground">Format</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-format"
              checked={format === "svg"}
              onChange={() => chooseFormat("svg")}
            />
            SVG
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-format"
              checked={format === "png"}
              onChange={() => chooseFormat("png")}
            />
            PNG
          </label>
        </fieldset>
        <fieldset
          className="flex flex-wrap items-center gap-4 text-sm disabled:opacity-50"
          disabled={format === "svg"}
        >
          <legend className="mr-2 text-muted-foreground">PNG scale</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-scale"
              checked={scale === 1}
              onChange={() => chooseScale(1)}
            />
            1×
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-scale"
              checked={scale === 2}
              onChange={() => chooseScale(2)}
            />
            2×
          </label>
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-4 text-sm">
          <legend className="mr-2 text-muted-foreground">Background</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-background"
              checked={background === "artboard"}
              onChange={() => chooseBackground("artboard")}
            />
            Artboard color
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="export-background"
              checked={background === "transparent"}
              onChange={() => chooseBackground("transparent")}
            />
            Transparent
          </label>
        </fieldset>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Preview</p>
          <div className="flex gap-2">
            {(
              [
                ["light", "Light"],
                ["dark", "Dark"],
                ["checkerboard", "Checkerboard"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                variant={ground === id ? "default" : "outline"}
                aria-pressed={ground === id}
                onClick={() => setGround(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid h-56 place-items-center overflow-hidden rounded-lg border" style={groundStyle}>
            {previewUrl ? (
              // The blob is a local export of this artboard, not remote content.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for fonts…</p>
            )}
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="button" disabled={waiting} onClick={() => void download()}>
          {waiting ? "Waiting for fonts…" : "Download"}
        </Button>
      </div>
    </div>
  );
}
