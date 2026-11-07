"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { PanelSelect } from "@/components/ui/panel-select";
import { ColorInput } from "@/features/editor/color-input";
import type { EditorFontOption } from "@/features/editor/types";
import type { ProjectDocument } from "@/features/projects/document";
import {
  cancelActiveReconstructions,
  cancelReconstruction,
} from "@/features/reconstruction/actions";
import {
  asExactEditablePieces,
  attachLiveText,
  isWordImageSlice,
  mergePaths,
  preferEditableElements,
  promoteWordSliceToLiveText,
  textLikeBands,
  useEditableText,
  useVectorOutlines,
} from "@/features/reconstruction/correct";
import { recognizeLogoText } from "@/features/reconstruction/ocr-browser";
import { createObjectId } from "@/features/editor/objects";
import { getGuestAsset, registerGuestAsset, uploadSrc } from "@/features/editor/guest-assets";
import { templatePreviewSvg } from "@/features/templates/preview";

const GUEST_DRAFT_TIMEOUT_MS = 20_000;

type View = "original" | "overlay" | "draft" | "side";

/** Empty/HTML error bodies from live serverless must not throw JSON.parse in the browser. */
async function readResponseJson<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const quiet =
  "h-9 rounded-full border border-white/15 bg-white/[0.04] px-4 text-white/85 hover:bg-white/10 hover:text-white";
const primary =
  "home-cta h-11 rounded-full bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#fff7ed_100%)] px-5 text-sm font-medium text-[#1a1028] shadow-[0_14px_34px_-12px_rgba(167,139,250,0.9),0_8px_18px_-12px_rgba(251,146,60,0.5)] hover:brightness-[1.03]";
const field =
  "rounded-lg border border-white/12 bg-white/[0.04] px-2 text-sm text-white outline-none transition focus:border-[#c4b5fd]/45 [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";
const numField = cn(field, "h-7 w-[4.25rem] text-center text-xs tabular-nums");

function Segment({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex flex-wrap rounded-xl bg-white/[0.06] p-1", className)} role="group">
      {children}
    </div>
  );
}

function Choice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all",
        active
          ? "bg-white text-[#1a1028] shadow-[0_8px_18px_-12px_rgba(196,181,253,0.95)]"
          : "text-white/70 hover:bg-white/8 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function ReconstructDialog({
  projectId,
  fonts,
  onApply,
  onClose,
  assetId: initialAssetId = null,
  intent = "upload",
  guest = false,
}: {
  projectId: string;
  fonts: EditorFontOption[];
  onApply: (document: ProjectDocument, hand?: boolean) => void;
  onClose: () => void;
  /** Reuse an existing upload (Edit elements) instead of asking for a new file. */
  assetId?: string | null;
  intent?: "upload" | "elements";
  guest?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("original");
  const [saving, setSaving] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  /** Bumps on each auto-start so Strict Mode / double mounts cannot commit a stale job over a good save. */
  const runGeneration = useRef(0);

  /**
   * Server drafts skip OCR (Tesseract crashes on Vercel). Read words in the browser so
   * BLOOM / ATELIER become live text (font, size, color) instead of image slices.
   */
  async function prepareEditableDraft(
    document: ProjectDocument,
    image: Blob,
    natural: { width: number; height: number },
  ) {
    let next = document;
    try {
      const bandsArtboard = textLikeBands(document);
      const scaleX = natural.width / Math.max(1, document.artboard.width);
      const scaleY = natural.height / Math.max(1, document.artboard.height);
      const bands = bandsArtboard.map((band) => ({
        x: band.x * scaleX,
        y: band.y * scaleY,
        width: band.width * scaleX,
        height: band.height * scaleY,
      }));
      const hits = await recognizeLogoText(image, { bands });
      next = attachLiveText(document, hits, natural.width, natural.height, bandsArtboard);
    } catch {
      // Shapes still open; words may stay as path slices if OCR fails.
    }
    return preferEditableElements(next);
  }

  async function choose(next: File | null) {
    setError(null);
    setDraft(null);
    setFailed(false);
    if (!next) {
      setFile(null);
      setSize(null);
      return;
    }
    if (next.type !== "image/png" && next.type !== "image/jpeg") {
      setFile(null);
      setSize(null);
      setError("Use a PNG or JPG image.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(next);
      const measured = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (measured.width < 1 || measured.height < 1) {
        setFile(null);
        setSize(null);
        setError("That file is not a valid image.");
        return;
      }
      setFile(next);
      setSize(measured);
    } catch {
      setFile(null);
      setSize(null);
      setError("That file is not a valid image.");
    }
  }

  async function createGuestDraftFromFile(source: File, measured: { width: number; height: number }, isStale?: () => boolean) {
    const body = new FormData();
    body.set("file", source);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), GUEST_DRAFT_TIMEOUT_MS);
    try {
      const response = await fetch("/api/reconstruction/guest", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload = await readResponseJson<{
        asset?: { id: string; width: number; height: number; mimeType: string };
        document?: ProjectDocument;
        recovered?: boolean;
        error?: { message?: string };
      }>(response);
      if (!response.ok || !payload?.asset || !payload?.document) {
        throw new Error(payload?.error?.message ?? "Could not build a draft from this image.");
      }
      if (isStale?.()) return;
      registerGuestAsset({
        id: payload.asset.id,
        blob: source,
        mimeType: payload.asset.mimeType || source.type || "image/png",
        width: payload.asset.width,
        height: payload.asset.height,
        name: source.name,
      });
      const prepared = await prepareEditableDraft(payload.document, source, {
        width: payload.asset.width,
        height: payload.asset.height,
      });
      if (isStale?.()) return;
      setDraft(prepared);
      setFailed(Boolean(payload.recovered));
      setMergeIds([]);
      setView("side");
      if (intent === "elements" && !payload.recovered) {
        await commitDocument(prepared, "shapes");
      }
    } catch (reason) {
      if (isStale?.()) return;
      // Keep the session moving: place an exact-image draft so Save still works.
      const asset = registerGuestAsset({
        blob: source,
        mimeType: source.type || "image/png",
        width: measured.width,
        height: measured.height,
        name: source.name,
      });
      const fallback = buildGuestExactDocument(asset.id, measured.width, measured.height);
      setDraft(fallback);
      setFailed(false);
      setMergeIds([]);
      setView("original");
      if (intent === "elements") {
        await commitDocument(fallback, "shapes");
        return;
      }
      setError(
        reason instanceof DOMException && reason.name === "AbortError"
          ? "That took too long. Your exact upload is ready — Save places it on the artboard."
          : "Could not break the image into shapes. Your exact upload is ready — Save places it on the artboard.",
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function createDraftFromAsset(assetId: string, isStale?: () => boolean) {
    setError(null);
    setRunning(true);
    let activeJobId: string | null = null;
    try {
      if (guest) {
        const local = getGuestAsset(assetId);
        if (!local) throw new Error("That image could not be found in this session.");
        // Always slice via guest draft so Edit elements gets movable marks + live words.
        await createGuestDraftFromFile(
          new File([local.blob], local.name, { type: local.mimeType }),
          { width: local.width, height: local.height },
          isStale,
        );
        return;
      }
      // Clear any stuck/in-flight job so Edit elements is not blocked by a prior run.
      // Server-action flight responses can be empty on live — never let that surface as JSON.parse.
      try {
        await cancelActiveReconstructions();
      } catch {
        // Continue; starting a new job still works if cancel failed.
      }
      if (isStale?.()) return;
      const started = await fetch("/api/reconstruction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, assetId }),
      });
      const startBody = await readResponseJson<{
        job?: { id: string; status?: string };
        error?: { message?: string };
      }>(started);
      if (!started.ok || !startBody?.job) {
        throw new Error(startBody?.error?.message ?? "Could not build a draft from this image.");
      }
      activeJobId = startBody.job.id;
      setJobId(activeJobId);
      if (isStale?.()) {
        try {
          await cancelReconstruction(activeJobId);
        } catch {
          // Ignore cancel failures when abandoning a stale run.
        }
        return;
      }
      // Live API now finishes the job inline; only poll if it is still queued/running.
      const outcome =
        startBody.job.status === "succeeded" || startBody.job.status === "failed"
          ? startBody.job.status
          : await pollJob(activeJobId);
      if (isStale?.()) return;
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const project = await readResponseJson<{
        project?: { document: ProjectDocument };
      }>(projectResponse);
      if (isStale?.()) return;
      if (project?.project?.document) {
        const sourceDoc = project.project.document;
        const original = sourceDoc.objects.find(
          (object) => object.name === "Original" && object.type === "image" && object.assetId,
        );
        let prepared = preferEditableElements(sourceDoc);
        if (original?.assetId) {
          try {
            const upload = await fetch(`/api/uploads/${original.assetId}`, { credentials: "same-origin" });
            if (upload.ok) {
              const blob = await upload.blob();
              const bitmap = await createImageBitmap(blob);
              const natural = { width: bitmap.width, height: bitmap.height };
              bitmap.close();
              prepared = await prepareEditableDraft(sourceDoc, blob, natural);
            }
          } catch {
            // Keep shape-only draft if browser OCR fails.
          }
        }
        if (isStale?.()) return;
        const hasOriginal = prepared.objects.some((object) => object.name === "Original");
        if (outcome === "succeeded" || hasOriginal) {
          setDraft(prepared);
          setFailed(outcome !== "succeeded");
          setMergeIds([]);
          setView("side");
          if (intent === "elements" && outcome === "succeeded") {
            await commitDocument(prepared, "shapes");
          }
          return;
        }
      }
      setError("Could not build a draft from this image.");
    } catch (reason) {
      if (!isStale?.()) {
        setError(reason instanceof Error ? reason.message : "Could not build a draft from this image.");
      }
    } finally {
      if (!isStale?.()) setRunning(false);
    }
  }

  async function createDraft() {
    if (!file || !size) return;
    setError(null);
    setRunning(true);
    try {
      if (guest) {
        await createGuestDraftFromFile(file, size);
        return;
      }
      const body = new FormData();
      body.set("file", file);
      const uploaded = await fetch("/api/uploads", { method: "POST", body });
      const uploadBody = await readResponseJson<{
        asset?: { id: string };
        error?: { message?: string };
      }>(uploaded);
      if (!uploaded.ok || !uploadBody?.asset) {
        throw new Error(uploadBody?.error?.message ?? "That image could not be uploaded.");
      }
      await createDraftFromAsset(uploadBody.asset.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not build a draft from this image.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!initialAssetId) return;
    const generation = ++runGeneration.current;
    const isStale = () => generation !== runGeneration.current;
    void createDraftFromAsset(initialAssetId, isStale);
    return () => {
      // Invalidate this run; createDraftFromAsset cancels its job when it notices stale.
      if (runGeneration.current === generation) runGeneration.current += 1;
      if (jobId) {
        void cancelReconstruction(jobId).catch(() => undefined);
      }
    };
    // Only auto-start once per asset when Edit elements opens the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/asset trigger
  }, [initialAssetId]);

  function buildSaveDocument(source: ProjectDocument, mode: "image" | "shapes" | "hand") {
    const original = source.objects.find((object) => object.name === "Original" && object.type === "image");
    const traced = source.objects.filter((object) => !(object.name === "Original" && object.type === "image"));

    let objects: ProjectDocument["objects"];
    if (mode === "image") {
      if (!original) return null;
      objects = [{ ...original, name: "Logo", visible: true, locked: false, opacity: 1 }];
    } else if (mode === "hand") {
      objects = original
        ? [
            { ...original, visible: true, locked: true, opacity: 1 },
            ...traced.map((object) => ({ ...object, visible: false, locked: false })),
          ]
        : traced.map((object) => ({ ...object, visible: false, locked: false }));
    } else {
      // Exact Logo (with holes) + clipped pieces — matches the upload, parts move without ghosts.
      if (!original?.assetId) return null;
      objects = asExactEditablePieces(
        { ...source, objects: [original, ...traced] },
        original,
      ).objects;
    }

    return {
      ...source,
      objects,
      reconstruction: source.reconstruction
        ? {
            ...source.reconstruction,
            keepShapes: mode === "shapes",
            // Keep exact upload edges — "Remove" in the editor can still fill punched holes later.
            keepEdgeOutlines: mode === "shapes" ? true : source.reconstruction.keepEdgeOutlines,
            note:
              mode === "image"
                ? "Your exact upload is on the artboard as Logo. Edit that same image."
                : mode === "shapes"
                  ? "Artboard matches your upload pixel-for-pixel. Marks and words are movable slices of the exact image."
                  : source.reconstruction.note,
          }
        : source.reconstruction,
    };
  }

  async function commitDocument(source: ProjectDocument, mode: "image" | "shapes" | "hand") {
    const nextDocument = buildSaveDocument(source, mode);
    if (!nextDocument) {
      setError("The upload is missing from this draft.");
      return;
    }
    setSaving(true);
    setError(null);
    if (guest) {
      setSaving(false);
      onApply(nextDocument, mode === "hand");
      return;
    }
    const response = await fetch(`/api/projects/${projectId}/document`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document: nextDocument, source: "autosave" }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("That project could not be saved.");
      return;
    }
    onApply(nextDocument, mode === "hand");
  }

  async function save(mode: "image" | "shapes" | "hand" = "image") {
    if (!draft) return;
    await commitDocument(draft, mode);
  }

  const colors = [
    ...new Set(draft?.objects.flatMap((object) => (object.type === "path" && object.fill ? [object.fill] : [])) ?? []),
  ];
  const comparing = Boolean(draft && !failed);
  const title =
    intent === "elements" ? "Edit elements" : comparing ? "Compare" : "Start from an image";
  const subtitle =
    intent === "elements"
      ? comparing
        ? "Each part is a slice of your real upload — same pixels as the original, separately editable."
        : "Slicing your upload into editable parts…"
      : comparing
        ? "Save keeps your exact upload on the artboard. Break into shapes unlocks every part."
        : "Drop a mark. Save keeps that exact image on the artboard.";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050214]/72 p-3 backdrop-blur-md sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !running) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconstruct-title"
        aria-busy={running || saving}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-[1.5rem] border border-white/12 bg-[linear-gradient(165deg,rgba(28,16,52,0.98)_0%,rgba(10,6,22,0.98)_100%)] text-white shadow-[0_40px_100px_-28px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
          comparing
            ? "h-[min(32rem,calc(100dvh-2rem))] max-w-[52rem]"
            : "max-h-[calc(100dvh-2rem)] max-w-lg",
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !running) onClose();
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

        <div className="relative flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.28em] text-white/45 uppercase">Image</p>
            <h2 id="reconstruct-title" className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
              {title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-white/55 sm:text-sm">{subtitle}</p>
          </div>
          {comparing ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className={cn(quiet, "h-8 px-3 text-xs")}
                onClick={() => void save("hand")}
              >
                Draw missing
              </Button>
              {intent === "elements" ? (
                <Button
                  type="button"
                  disabled={saving}
                  className={cn(primary, "h-8 px-4 text-xs")}
                  onClick={() => void save("shapes")}
                >
                  {saving ? "Saving…" : "Edit elements"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={saving}
                    className={cn(primary, "h-8 px-4 text-xs")}
                    onClick={() => void save("image")}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    className={cn(quiet, "h-8 px-3 text-xs")}
                    onClick={() => void save("shapes")}
                  >
                    Break into shapes
                  </Button>
                </>
              )}
            </div>
          ) : (
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
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4 sm:px-5 sm:pb-5">
          {running || (Boolean(initialAssetId) && !draft && !error) ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-2.5 animate-pulse rounded-full bg-gradient-to-r from-[#67e8f9] to-[#d8b4fe]"
                />
                <p className="text-sm font-medium text-white">Reading shapes and text…</p>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-white/60">
                Building editable parts that match your exact upload.
              </p>
              <Button
                type="button"
                variant="outline"
                className={quiet}
                onClick={() => {
                  if (jobId) void cancelReconstruction(jobId).catch(() => undefined);
                  onClose();
                }}
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {!running && !draft && !(initialAssetId && !error) ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-white/60">
                PNG and JPG only. Save places that exact image on the artboard so you can select, move, and
                resize it.
              </p>
              <label
                className={cn(
                  "group relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed px-5 py-10 text-center transition",
                  file
                    ? "border-[#c4b5fd]/45 bg-[#c4b5fd]/8"
                    : "border-white/20 bg-white/[0.03] hover:border-white/35 hover:bg-white/[0.05]",
                )}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void choose(event.dataTransfer.files[0] ?? null);
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-[#7c3aed]/25 blur-3xl transition group-hover:bg-[#7c3aed]/35"
                />
                <div className="relative flex flex-col items-center gap-2">
                  <p className="text-sm font-medium text-white">
                    {file ? "Image ready" : "Drop a PNG or JPG, or browse"}
                  </p>
                  <p className="text-xs tracking-wide text-white/45">
                    {file && size
                      ? `${file.name} · ${size.width}×${size.height} · ${formatBytes(file.size)}`
                      : "Click to choose a file"}
                  </p>
                </div>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  aria-label="Reconstruction image"
                  onChange={(event) => {
                    void choose(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-[#fda4af]">
                  {error}
                </p>
              ) : null}
              <Button type="button" disabled={!file} className={cn(primary, "w-full")} onClick={() => void createDraft()}>
                Create draft
              </Button>
            </div>
          ) : null}

          {!running && draft && failed ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-medium text-white">Could not build a draft from this image.</p>
              <p className="text-sm leading-relaxed text-white/60">
                The original stays on the canvas so you can keep editing it.
              </p>
              <Button type="button" className={cn(primary, "w-full sm:w-auto")} onClick={() => onApply(draft)}>
                Back to editor
              </Button>
            </div>
          ) : null}

          {!running && draft && !failed ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
              <Segment className="shrink-0">
                {(["original", "overlay", "draft", "side"] as const).map((item) => (
                  <Choice key={item} active={view === item} onClick={() => setView(item)}>
                    {item === "original"
                      ? "Original"
                      : item === "overlay"
                        ? "Overlay"
                        : item === "draft"
                          ? "Draft"
                          : "Side by side"}
                  </Choice>
                ))}
              </Segment>
              <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_15.5rem]">
                <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                  {view === "side" ? (
                    <div className="grid h-full max-h-[min(18rem,42dvh)] w-full grid-cols-2 gap-2">
                      <CompareView document={draft} view="original" compact />
                      <CompareView document={draft} view="draft" compact />
                    </div>
                  ) : (
                    <div className="h-full max-h-[min(18rem,42dvh)] w-full max-w-[min(100%,18rem)]">
                      <CompareView document={draft} view={view} compact />
                    </div>
                  )}
                </div>
                <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-[11px] tracking-[0.16em] text-white/45 uppercase">Detected</p>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(quiet, "ml-auto h-7 px-2.5 text-[11px]")}
                      disabled={mergeIds.length < 2}
                      onClick={() => {
                        const result = mergePaths(draft, mergeIds);
                        if (result.error) {
                          setError(result.error);
                          return;
                        }
                        setMergeIds([]);
                        setDraft(result.document);
                        setError(null);
                      }}
                    >
                      Merge
                    </Button>
                  </div>
                  <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto text-sm [scrollbar-width:thin]">
                    {draft.objects
                      .filter(
                        (object) =>
                          object.type !== "image" || isWordImageSlice(object),
                      )
                      .filter((object) => object.name !== "Logo" && object.name !== "Original")
                      .map((object) => (
                        <li
                          key={object.id}
                          className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2"
                        >
                          <span className="flex flex-wrap items-center gap-1.5 text-xs">
                            {object.type === "path" ? (
                              <input
                                type="checkbox"
                                aria-label={`Merge ${object.name}`}
                                className="size-3 accent-[#d8b4fe]"
                                checked={mergeIds.includes(object.id)}
                                onChange={(event) =>
                                  setMergeIds((current) =>
                                    event.target.checked
                                      ? [...current, object.id]
                                      : current.filter((id) => id !== object.id),
                                  )
                                }
                              />
                            ) : null}
                            <span className="font-medium">
                              {object.name}{" "}
                              <span className="font-normal text-white/45">
                                {object.type === "text"
                                  ? "text"
                                  : isWordImageSlice(object)
                                    ? "word"
                                    : "path"}
                              </span>
                            </span>
                            {(object.type === "text" || isWordImageSlice(object)) &&
                            object.confidence !== undefined ? (
                              <span className="text-white/45">{object.confidence}%</span>
                            ) : null}
                            {!object.visible ? <span className="text-white/45">hidden</span> : null}
                          </span>
                          {object.type === "text" || isWordImageSlice(object) ? (
                            <TextRow
                              text={object.text ?? ""}
                              fontId={object.fontId ?? "outfit"}
                              fonts={fonts}
                              onText={(text) => {
                                if (isWordImageSlice(object)) {
                                  apply(promoteWordSliceToLiveText(draft, object.id, { text }));
                                  return;
                                }
                                updateObject(object.id, { text, name: text.slice(0, 40) || object.name });
                              }}
                              onFont={(fontId) => {
                                const font = fonts.find((item) => item.id === fontId);
                                if (isWordImageSlice(object)) {
                                  apply(
                                    promoteWordSliceToLiveText(draft, object.id, {
                                      fontId,
                                      fontFamily: font?.canvasFamily ?? "Outfit",
                                    }),
                                  );
                                  return;
                                }
                                updateObject(object.id, {
                                  fontId,
                                  fontFamily: font?.canvasFamily ?? "Outfit",
                                });
                              }}
                            />
                          ) : null}
                          {object.type === "text" ? (
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(quiet, "h-7 px-2 text-[11px]")}
                                onClick={() => apply(useVectorOutlines(draft, object.id))}
                              >
                                Outlines
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(quiet, "h-7 px-2 text-[11px]")}
                                onClick={() => apply(useEditableText(draft, object.id))}
                              >
                                Text
                              </Button>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-2 items-center gap-x-2 gap-y-1.5">
                            <div className="col-span-2 flex items-center gap-2">
                              {object.fill ? (
                                <ColorInput
                                  aria-label={`Color of ${object.name}`}
                                  className="size-7 shrink-0"
                                  value={object.fill}
                                  onChange={(value) => updateObject(object.id, { fill: value })}
                                />
                              ) : null}
                              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-white/55">
                                <span className="w-3 shrink-0">X</span>
                                <input
                                  aria-label={`X of ${object.name}`}
                                  className={cn(numField, "w-full min-w-0")}
                                  type="number"
                                  value={Math.round(object.x)}
                                  onChange={(event) =>
                                    updateObject(object.id, { x: numberValue(event.target.value, object.x) })
                                  }
                                />
                              </label>
                              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-white/55">
                                <span className="w-3 shrink-0">Y</span>
                                <input
                                  aria-label={`Y of ${object.name}`}
                                  className={cn(numField, "w-full min-w-0")}
                                  type="number"
                                  value={Math.round(object.y)}
                                  onChange={(event) =>
                                    updateObject(object.id, { y: numberValue(event.target.value, object.y) })
                                  }
                                />
                              </label>
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                              {object.type === "path" ? (
                                <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-white/55">
                                  <span className="w-3 shrink-0">%</span>
                                  <input
                                    aria-label={`Scale of ${object.name}`}
                                    className={cn(numField, "w-full min-w-0")}
                                    type="number"
                                    min={10}
                                    max={400}
                                    value={Math.round(object.scaleX * 100)}
                                    onChange={(event) => {
                                      const scale = Math.max(
                                        0.1,
                                        Math.min(4, numberValue(event.target.value, object.scaleX * 100) / 100),
                                      );
                                      updateObject(object.id, { scaleX: scale, scaleY: scale });
                                    }}
                                  />
                                </label>
                              ) : (
                                <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-white/55">
                                  <span className="shrink-0">Size</span>
                                  <input
                                    aria-label={`Size of ${object.name}`}
                                    className={cn(numField, "w-full min-w-0")}
                                    type="number"
                                    min={12}
                                    max={240}
                                    value={Math.round(object.fontSize ?? 32)}
                                    onChange={(event) => {
                                      const fontSize = Math.max(
                                        12,
                                        Math.min(240, numberValue(event.target.value, object.fontSize ?? 32)),
                                      );
                                      updateObject(object.id, {
                                        fontSize,
                                        height: Math.max(8, Math.round(fontSize / 0.82)),
                                      });
                                    }}
                                  />
                                </label>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(quiet, "h-7 shrink-0 px-2.5 text-[11px]")}
                                onClick={() => updateObject(object.id, { visible: !object.visible })}
                              >
                                {object.visible ? "Hide" : "Show"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(quiet, "h-7 shrink-0 px-2.5 text-[11px]")}
                                onClick={() => {
                                  setMergeIds((current) => current.filter((id) => id !== object.id));
                                  setDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          objects: current.objects.filter((item) => item.id !== object.id),
                                        }
                                      : current,
                                  );
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                  <p className="shrink-0 truncate text-[11px] text-white/50">
                    Colors: <span className="text-[#d8b4fe]">{colors.length > 0 ? colors.join(" ") : "none"}</span>
                  </p>
                  {error ? (
                    <p role="alert" className="shrink-0 text-xs text-[#fda4af]">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  function apply(result: { document: ProjectDocument; error: string | null }) {
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setDraft(result.document);
  }

  function updateObject(id: string, patch: Partial<ProjectDocument["objects"][number]>) {
    setDraft((current) =>
      current
        ? { ...current, objects: current.objects.map((object) => (object.id === id ? { ...object, ...patch } : object)) }
        : current,
    );
  }
}

function numberValue(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function CompareView({
  document,
  view,
  compact = false,
}: {
  document: ProjectDocument;
  view: Exclude<View, "side">;
  compact?: boolean;
}) {
  const original = document.objects.find((object) => object.type === "image");
  const shapes = {
    ...document,
    objects: document.objects.filter((object) => object.type !== "image"),
  };
  const markup = templatePreviewSvg(shapes);
  const width = original ? ((original.width * original.scaleX) / document.artboard.width) * 100 : 100;
  const height = original ? ((original.height * original.scaleY) / document.artboard.height) * 100 : 100;
  // Draft uses the exact upload pixels (same as Original). Overlay adds traced shapes on top.
  const showShapes = view === "overlay";
  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-xl border border-white/10 bg-[repeating-conic-gradient(#ececec_0%_25%,#f7f7f7_0%_50%)] bg-[length:24px_24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        compact ? "h-full max-h-full w-full max-w-full" : "w-full",
      )}
      style={{ aspectRatio: `${document.artboard.width} / ${document.artboard.height}` }}
    >
      {original?.assetId ? (
        // The reconstruction upload is served only to the signed-in owner.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={view === "draft" ? "Draft from original upload" : "Original upload"}
          src={uploadSrc(original.assetId)}
          className="absolute top-0 left-0 max-w-none"
          style={{ width: `${width}%`, height: `${height}%` }}
        />
      ) : null}
      {showShapes ? (
        <div
          className="absolute inset-0"
          style={{ opacity: 0.85 }}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ) : null}
    </div>
  );
}

function TextRow({
  text,
  fontId,
  fonts,
  onText,
  onFont,
}: {
  text: string;
  fontId: string;
  fonts: EditorFontOption[];
  onText: (text: string) => void;
  onFont: (fontId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <input
        aria-label={`Edit ${text}`}
        className={cn(field, "h-7 px-2 text-xs")}
        value={text}
        onChange={(event) => onText(event.target.value.slice(0, 500))}
      />
      <PanelSelect
        ariaLabel="Font"
        size="sm"
        value={fontId}
        onChange={onFont}
        options={fonts.map((font) => ({ value: font.id, label: font.label }))}
      />
    </div>
  );
}

async function pollJob(jobId: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const response = await fetch(`/api/reconstruction/${jobId}`);
    if (!response.ok) return "failed";
    const body = await readResponseJson<{ job?: { status?: string } }>(response);
    if (body?.job?.status === "succeeded") return "succeeded";
    if (body?.job?.status === "failed") return "failed";
  }
  return "failed";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function buildGuestExactDocument(assetId: string, width: number, height: number): ProjectDocument {
  const layoutScale = Math.max(1, 256 / width, 256 / height);
  const boardWidth = Math.max(256, Math.min(2048, Math.round(width * layoutScale)));
  const boardHeight = Math.max(256, Math.min(2048, Math.round(height * layoutScale)));
  const scale = boardWidth / width;
  let preset: ProjectDocument["artboard"]["preset"] = "custom";
  if (boardWidth === 1000 && boardHeight === 1000) preset = "square";
  else if (boardWidth === 512 && boardHeight === 512) preset = "icon";
  else if (boardWidth === 1600 && boardHeight === 800) preset = "horizontal";
  else if (boardWidth === 800 && boardHeight === 1400) preset = "vertical";
  return {
    schemaVersion: 1,
    artboard: {
      preset,
      width: boardWidth,
      height: boardHeight,
      background: "#07041c",
    },
    objects: [
      {
        id: createObjectId(),
        type: "image",
        name: "Original",
        x: 0,
        y: 0,
        width,
        height,
        scaleX: Number(scale.toFixed(4)),
        scaleY: Number(scale.toFixed(4)),
        angle: 0,
        opacity: 1,
        visible: true,
        locked: false,
        assetId,
      },
    ],
    reconstruction: {
      jobId: `guest_${assetId}`.slice(0, 80),
      sourceAssetId: assetId,
      note: "Your exact upload is on the artboard as Logo. Edit that same image.",
      keepShapes: false,
    },
  };
}
