"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EditorFontOption } from "@/features/editor/types";
import type { ProjectDocument } from "@/features/projects/document";
import { cancelReconstruction } from "@/features/reconstruction/actions";
import { mergePaths, useEditableText, useVectorOutlines } from "@/features/reconstruction/correct";
import { templatePreviewSvg } from "@/features/templates/preview";

type View = "original" | "overlay" | "draft" | "side";

const MAX_BYTES = 8 * 1024 * 1024;

export function ReconstructDialog({
  projectId,
  fonts,
  onApply,
  onClose,
}: {
  projectId: string;
  fonts: EditorFontOption[];
  onApply: (document: ProjectDocument, hand?: boolean) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("overlay");
  const [saving, setSaving] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[]>([]);

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

  async function createDraft() {
    if (!file) return;
    setError(null);
    setRunning(true);
    try {
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
      const started = await fetch("/api/reconstruction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, assetId: uploadBody.asset.id }),
      });
      const startBody = (await started.json()) as {
        job?: { id: string };
        error?: { message?: string };
      };
      if (!started.ok || !startBody.job) {
        throw new Error(startBody.error?.message ?? "Could not build a draft from this image.");
      }
      setJobId(startBody.job.id);
      const outcome = await pollJob(startBody.job.id);
      const project = await fetch(`/api/projects/${projectId}`).then((response) => response.json()) as {
        project?: { document: ProjectDocument };
      };
      if (outcome === "succeeded" && project.project) {
        setDraft(project.project.document);
        setMergeIds([]);
        setView("overlay");
      } else if (project.project?.document.objects.some((object) => object.name === "Original")) {
        setDraft(project.project.document);
        setFailed(true);
      } else {
        setError("Could not build a draft from this image.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not build a draft from this image.");
    } finally {
      setRunning(false);
    }
  }

  async function save(hand = false) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/document`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document: draft, source: "save" }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("That project could not be saved.");
      return;
    }
    onApply(draft, hand);
  }

  const colors = [
    ...new Set(draft?.objects.flatMap((object) => (object.type === "path" && object.fill ? [object.fill] : [])) ?? []),
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconstruct-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-4 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <h2 id="reconstruct-title" className="text-base font-medium">
            {draft && !failed ? "Compare" : "Start from an image"}
          </h2>
          {draft && !failed ? (
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
                Draw a missing part
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save(false)}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {running ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Reading the image…</p>
            <p className="text-sm text-muted-foreground">
              This builds an editable draft. It will not match every original.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (jobId) void cancelReconstruction(jobId);
                onClose();
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}

        {!running && !draft ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              PNG and JPG only. Up to 8 MB. 64 to 4096 px on each side. This builds an editable draft. It will not match every original.
            </p>
            <label
              className="grid min-h-28 cursor-pointer place-items-center rounded-xl border border-dashed px-4 py-8 text-center text-sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void choose(event.dataTransfer.files[0] ?? null);
              }}
            >
              Drop a PNG or JPG, or browse
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
            {file && size ? (
              <p className="text-sm">
                {file.name} · {size.width}×{size.height} · {formatBytes(file.size)}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="button" disabled={!file} onClick={() => void createDraft()}>
              Create draft
            </Button>
          </div>
        ) : null}

        {!running && draft && failed ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Could not build a draft from this image.</p>
            <p className="text-sm text-muted-foreground">The original is still on the canvas as a locked layer.</p>
            <Button type="button" onClick={() => onApply(draft)}>
              Back to editor
            </Button>
          </div>
        ) : null}

        {!running && draft && !failed ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{draft.reconstruction?.note}</p>
            <div className="flex flex-wrap gap-2">
              {(["original", "overlay", "draft", "side"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={view === item ? "default" : "outline"}
                  onClick={() => setView(item)}
                >
                  {item === "original" ? "Original" : item === "overlay" ? "Overlay" : item === "draft" ? "Draft" : "Side by side"}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              {view === "side" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm">Original</p>
                    <CompareView document={draft} view="original" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm">Draft</p>
                    <CompareView document={draft} view="draft" />
                  </div>
                </div>
              ) : (
                <CompareView document={draft} view={view} />
              )}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Detected</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
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
                <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto text-sm">
                  {draft.objects
                    .filter((object) => object.type !== "image")
                    .map((object) => (
                      <li key={object.id} className="flex flex-col gap-2 rounded-lg border p-2">
                        <span className="flex flex-wrap items-center gap-2">
                          {object.type === "path" ? (
                            <input
                              type="checkbox"
                              aria-label={`Merge ${object.name}`}
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
                          <span>
                            {object.name}{" "}
                            <span className="text-muted-foreground">{object.type === "text" ? "text" : "path"}</span>
                          </span>
                          {object.type === "text" && object.confidence !== undefined ? (
                            <span className="text-muted-foreground">{object.confidence}%</span>
                          ) : null}
                          {!object.visible ? <span className="text-muted-foreground">hidden</span> : null}
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
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => apply(useVectorOutlines(draft, object.id))}>
                              Use outlines
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => apply(useEditableText(draft, object.id))}>
                              Use text
                            </Button>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {object.fill ? (
                            <input
                              type="color"
                              aria-label={`Color of ${object.name}`}
                              value={object.fill}
                              onChange={(event) => updateObject(object.id, { fill: event.target.value })}
                            />
                          ) : null}
                          <label className="flex items-center gap-1">
                            X
                            <input
                              aria-label={`X of ${object.name}`}
                              className="h-8 w-16 rounded-md border bg-background px-1"
                              type="number"
                              value={Math.round(object.x)}
                              onChange={(event) => updateObject(object.id, { x: numberValue(event.target.value, object.x) })}
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            Y
                            <input
                              aria-label={`Y of ${object.name}`}
                              className="h-8 w-16 rounded-md border bg-background px-1"
                              type="number"
                              value={Math.round(object.y)}
                              onChange={(event) => updateObject(object.id, { y: numberValue(event.target.value, object.y) })}
                            />
                          </label>
                          {object.type === "path" ? (
                            <label className="flex items-center gap-1">
                              Scale
                              <input
                                aria-label={`Scale of ${object.name}`}
                                className="h-8 w-16 rounded-md border bg-background px-1"
                                type="number"
                                min={10}
                                max={400}
                                value={Math.round(object.scaleX * 100)}
                                onChange={(event) => {
                                  const scale = Math.max(0.1, Math.min(4, numberValue(event.target.value, object.scaleX * 100) / 100));
                                  updateObject(object.id, { scaleX: scale, scaleY: scale });
                                }}
                              />
                            </label>
                          ) : (
                            <label className="flex items-center gap-1">
                              Size
                              <input
                                aria-label={`Size of ${object.name}`}
                                className="h-8 w-16 rounded-md border bg-background px-1"
                                type="number"
                                min={12}
                                max={240}
                                value={Math.round(object.fontSize ?? 32)}
                                onChange={(event) => {
                                  const fontSize = Math.max(12, Math.min(240, numberValue(event.target.value, object.fontSize ?? 32)));
                                  updateObject(object.id, { fontSize, height: Math.max(8, Math.round(fontSize / 0.82)) });
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updateObject(object.id, { visible: !object.visible })}
                          >
                            {object.visible ? "Hide" : "Show"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMergeIds((current) => current.filter((id) => id !== object.id));
                              setDraft((current) =>
                                current ? { ...current, objects: current.objects.filter((item) => item.id !== object.id) } : current,
                              );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
                <p className="text-sm">
                  Colors found: {colors.length > 0 ? colors.join(" ") : "none"}
                </p>
                <p className="text-sm text-muted-foreground">
                  A percent is how sure the text reading was. Use outlines when the letter shapes matter more than editing the word. Merge joins selected shapes. Draw a missing part opens the pen after save. The original stays locked.
                </p>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
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

function CompareView({ document, view }: { document: ProjectDocument; view: Exclude<View, "side"> }) {
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
      className="relative overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#ececec_0%_25%,#f7f7f7_0%_50%)] bg-[length:24px_24px]"
      style={{ aspectRatio: `${document.artboard.width} / ${document.artboard.height}` }}
    >
      {view !== "draft" && original?.assetId ? (
        // The reconstruction upload is served only to the signed-in owner.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Original upload"
          src={`/api/uploads/${original.assetId}`}
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
        className="h-8 rounded-md border bg-background px-2"
        value={text}
        onChange={(event) => onText(event.target.value.slice(0, 500))}
      />
      <select
        aria-label="Font"
        className="h-8 rounded-md border bg-background px-2"
        value={fontId}
        onChange={(event) => onFont(event.target.value)}
      >
        {fonts.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>
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
