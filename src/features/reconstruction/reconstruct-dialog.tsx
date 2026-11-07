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
  mergePaths,
  preferEditableElements,
  useEditableText,
  useVectorOutlines,
} from "@/features/reconstruction/correct";
import { getGuestAsset, registerGuestAsset, uploadSrc } from "@/features/editor/guest-assets";
import { templatePreviewSvg } from "@/features/templates/preview";

type View = "original" | "overlay" | "draft" | "side";

const MAX_BYTES = 8 * 1024 * 1024;

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
    if (next.size > MAX_BYTES) {
      setFile(null);
      setSize(null);
      setError("Files must be 8 MB or smaller.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(next);
      const measured = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (measured.width < 64 || measured.height < 64 || measured.width > 4096 || measured.height > 4096) {
        setFile(null);
        setSize(null);
        setError("Images must be between 64 and 4096 pixels on each edge.");
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

  async function createGuestDraftFromFile(source: File, isStale?: () => boolean) {
    const body = new FormData();
    body.set("file", source);
    const response = await fetch("/api/reconstruction/guest", { method: "POST", body });
    const payload = (await response.json()) as {
      asset?: { id: string; width: number; height: number; mimeType: string };
      document?: ProjectDocument;
      recovered?: boolean;
      error?: { message?: string };
    };
    if (!response.ok || !payload.asset || !payload.document) {
      throw new Error(payload.error?.message ?? "Could not build a draft from this image.");
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
    const prepared = preferEditableElements(payload.document);
    setDraft(prepared);
    setFailed(Boolean(payload.recovered));
    setMergeIds([]);
    setView("side");
    if (intent === "elements" && !payload.recovered) {
      await commitDocument(prepared, "shapes");
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
        await createGuestDraftFromFile(new File([local.blob], local.name, { type: local.mimeType }), isStale);
        return;
      }
      // Clear any stuck/in-flight job so Edit elements is not blocked by a prior run.
      await cancelActiveReconstructions();
      if (isStale?.()) return;
      const started = await fetch("/api/reconstruction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, assetId }),
      });
      const startBody = (await started.json()) as {
        job?: { id: string };
        error?: { message?: string };
      };
      if (!started.ok || !startBody.job) {
        throw new Error(startBody.error?.message ?? "Could not build a draft from this image.");
      }
      activeJobId = startBody.job.id;
      setJobId(activeJobId);
      if (isStale?.()) {
        void cancelReconstruction(activeJobId);
        return;
      }
      const outcome = await pollJob(activeJobId);
      if (isStale?.()) return;
      const project = (await fetch(`/api/projects/${projectId}`).then((response) => response.json())) as {
        project?: { document: ProjectDocument };
      };
      if (isStale?.()) return;
      if (outcome === "succeeded" && project.project) {
        const prepared = preferEditableElements(project.project.document);
        setDraft(prepared);
        setMergeIds([]);
        setView("side");
        // Edit elements: clipped slices with child holes punched out of parents (no ghosts).
        if (intent === "elements") {
          await commitDocument(prepared, "shapes");
          return;
        }
      } else if (project.project?.document.objects.some((object) => object.name === "Original")) {
        setDraft(project.project.document);
        setFailed(true);
      } else {
        setError("Could not build a draft from this image.");
      }
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
        await createGuestDraftFromFile(file);
        setRunning(false);
        return;
      }
      const body = new FormData();
      body.set("file", file);
      const uploaded = await fetch("/api/uploads", { method: "POST", body });
      const uploadBody = (await uploaded.json()) as {
        asset?: { id: string };
        error?: { message?: string };
      };
      if (!uploaded.ok || !uploadBody.asset) {
        throw new Error(uploadBody.error?.message ?? "That image could not be uploaded.");
      }
      await createDraftFromAsset(uploadBody.asset.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not build a draft from this image.");
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
      if (jobId) void cancelReconstruction(jobId);
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
            // Remove: fill punched holes so circle/letter edge rings do not ghost on the artboard.
            // Word bands stay punched; live text is sized to the upload ink box.
            keepEdgeOutlines: mode === "shapes" ? false : source.reconstruction.keepEdgeOutlines,
            note:
              mode === "image"
                ? "Your exact upload is on the artboard as Logo. Edit that same image."
                : mode === "shapes"
                  ? "Artboard matches your upload. Marks are movable slices; words are live text you can retype and restyle."
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
      body: JSON.stringify({ document: nextDocument, source: "save" }),
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
                <p className="text-sm font-medium text-white">Reading the image…</p>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-white/60">
                Building editable parts that match your exact upload.
              </p>
              <Button
                type="button"
                variant="outline"
                className={quiet}
                onClick={() => {
                  if (jobId) void cancelReconstruction(jobId);
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
                PNG and JPG only. Up to 8 MB. 64 to 4096 px on each side. Save places that exact image on the
                artboard so you can select, move, and resize it.
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
                      .filter((object) => object.type !== "image")
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
                                {object.type === "text" ? "text" : "path"}
                              </span>
                            </span>
                            {object.type === "text" && object.confidence !== undefined ? (
                              <span className="text-white/45">{object.confidence}%</span>
                            ) : null}
                            {!object.visible ? <span className="text-white/45">hidden</span> : null}
                          </span>
                          {object.type === "text" ? (
                            <TextRow
                              text={object.text ?? ""}
                              fontId={object.fontId ?? "outfit"}
                              fonts={fonts}
                              onText={(text) => updateObject(object.id, { text, name: text.slice(0, 40) || object.name })}
                              onFont={(fontId) => {
                                const font = fonts.find((item) => item.id === fontId);
                                updateObject(object.id, { fontId, fontFamily: font?.canvasFamily ?? "Outfit" });
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
  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-xl border border-white/10 bg-[repeating-conic-gradient(#ececec_0%_25%,#f7f7f7_0%_50%)] bg-[length:24px_24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        compact ? "h-full max-h-full w-full max-w-full" : "w-full",
      )}
      style={{ aspectRatio: `${document.artboard.width} / ${document.artboard.height}` }}
    >
      {view !== "draft" && original?.assetId ? (
        // The reconstruction upload is served only to the signed-in owner.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Original upload"
          src={uploadSrc(original.assetId)}
          className="absolute top-0 left-0 max-w-none"
          style={{ width: `${width}%`, height: `${height}%` }}
        />
      ) : null}
      {view !== "original" ? (
        <div
          className="absolute inset-0"
          style={{ opacity: view === "overlay" ? 0.85 : 1 }}
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const response = await fetch(`/api/reconstruction/${jobId}`);
    if (!response.ok) return "failed";
    const body = (await response.json()) as { job?: { status?: string } };
    if (body.job?.status === "succeeded") return "succeeded";
    if (body.job?.status === "failed") return "failed";
  }
  return "failed";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}
