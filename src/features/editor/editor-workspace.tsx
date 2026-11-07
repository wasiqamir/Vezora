"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VezoraMark } from "@/components/vezora-mark";
import { cn } from "@/lib/utils";
import { initialEditorSnapshot } from "@/features/editor/artboard";
import { CanvasController } from "@/features/editor/canvas-controller";
import { EditorFooter } from "@/features/editor/editor-footer";
import { ExportAuthDialog } from "@/features/editor/export-auth-dialog";
import { ExportDialog } from "@/features/editor/export-dialog";
import { editorPrimary, editorQuiet, editorStage } from "@/features/editor/editor-theme";
import { buildGuestDraft, saveGuestDraft } from "@/features/editor/guest-draft";
import { registerGuestAsset, uploadSrc } from "@/features/editor/guest-assets";
import { LayersPanel } from "@/features/editor/layers-panel";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import { Toolbar } from "@/features/editor/toolbar";
import { ReconstructDialog } from "@/features/reconstruction/reconstruct-dialog";
import { preferExactUpload, type ProjectDocument } from "@/features/projects/document";
import type { EditorFontOption, EditorSnapshot } from "@/features/editor/types";

const quiet = editorQuiet;
const primary = editorPrimary;

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
      if (!value) reject(new Error("image"));
      else resolve(value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("image"));
    reader.readAsDataURL(blob);
  });
}

export function EditorWorkspace({
  projectId,
  projectName,
  document,
  fonts,
  guest = false,
  templateSlug,
  openExport = false,
}: {
  projectId: string;
  projectName: string;
  document: ProjectDocument;
  fonts: EditorFontOption[];
  guest?: boolean;
  templateSlug?: string;
  openExport?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);
  const persistRef = useRef<(revision: number) => void>(() => {});
  const fontsRef = useRef(fonts);
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(initialEditorSnapshot);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootId, setBootId] = useState(0);
  const [exportOpen, setExportOpen] = useState(openExport);
  const [exportAuthOpen, setExportAuthOpen] = useState(false);
  const [reconstruct, setReconstruct] = useState<{ open: boolean; intent: "upload" | "elements" }>({
    open: false,
    intent: "upload",
  });
  const [sourceAssetId, setSourceAssetId] = useState(document.reconstruction?.sourceAssetId ?? null);
  const [sideBySide, setSideBySide] = useState(false);
  const pendingTool = useRef<"pen" | null>(null);
  const [name, setName] = useState(projectName);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const documentRef = useRef(document);
  const savedRevision = useRef(0);
  const savingRef = useRef(false);
  const pendingRevision = useRef<number | null>(null);
  const nameRef = useRef(projectName);
  const lastImageAt = useRef(0);
  nameRef.current = name;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    try {
      const controller = new CanvasController({
        host,
        canvas,
        fonts: fontsRef.current,
        document: documentRef.current,
        tool: pendingTool.current === "pen" ? "pen" : "select",
      });
      pendingTool.current = null;
      controllerRef.current = controller;
      const unsubscribe = controller.subscribe(setSnapshot);
      return () => {
        unsubscribe();
        controller.dispose();
        controllerRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The canvas could not start.";
      queueMicrotask(() => setBootError(message));
    }
  }, [bootId]);

  const persist = useCallback((revision: number) => {
    if (guest) {
      savedRevision.current = Math.max(savedRevision.current, revision);
      setSaveState("saved");
      return;
    }
    if (savingRef.current) {
      pendingRevision.current = revision;
      return;
    }
    const controller = controllerRef.current;
    if (!controller) return;
    savingRef.current = true;
    setSaveState("saving");
    void (async () => {
      let image: string | undefined;
      if (Date.now() - lastImageAt.current > 60_000) {
        try {
          const file = await controller.createExport({
            projectName: nameRef.current,
            format: "png",
            scale: 1,
            background: "artboard",
          });
          if (file.blob.size <= 2_500_000) {
            image = await blobToBase64(file.blob);
            lastImageAt.current = Date.now();
          }
        } catch {
          image = undefined;
        }
      }
      return fetch(`/api/projects/${projectId}/document`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: controller.projectDocument(), source: "autosave", image }),
      });
    })()
      .then((response) => {
        if (!response.ok) throw new Error("Save failed.");
        savedRevision.current = Math.max(savedRevision.current, revision);
        const next = pendingRevision.current;
        pendingRevision.current = null;
        savingRef.current = false;
        if (next != null && next > savedRevision.current) {
          persistRef.current(next);
          return;
        }
        setSaveState("saved");
      })
      .catch(() => {
        pendingRevision.current = null;
        savingRef.current = false;
        setSaveState("failed");
      });
  }, [guest, projectId]);

  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    if (!snapshot.ready || snapshot.revision === savedRevision.current) return;
    const revision = snapshot.revision;
    const timer = window.setTimeout(() => {
      persist(revision);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [persist, snapshot.ready, snapshot.revision]);

  useEffect(() => {
    if (guest) return;
    function flush() {
      const controller = controllerRef.current;
      if (!controller || savingRef.current || !snapshot.ready || snapshot.revision === savedRevision.current) return;
      void fetch(`/api/projects/${projectId}/document`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: controller.projectDocument(), source: "autosave" }),
        keepalive: true,
      });
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [guest, projectId, snapshot.ready, snapshot.revision]);

  async function rename(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === projectName) {
      setName(projectName);
      return;
    }
    if (guest) {
      setName(trimmed);
      return;
    }
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!response.ok) setName(projectName);
  }

  async function placeUploadedImage(file: File) {
    const controller = controllerRef.current;
    if (!controller) return;
    if (guest) {
      try {
        const bitmap = await createImageBitmap(file);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        const asset = registerGuestAsset({
          blob: file,
          mimeType: file.type || "image/png",
          width,
          height,
          name: file.name,
        });
        await controller.addUploadedImage(asset.id, asset.url);
      } catch {
        controller.showError("That image could not be placed.");
      }
      return;
    }
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as
      | { asset?: { id: string }; error?: { message?: string } }
      | null;
    if (!response.ok || !payload?.asset) {
      controller.showError(payload?.error?.message ?? "That image could not be placed.");
      return;
    }
    await controller.addUploadedImage(payload.asset.id, URL.createObjectURL(file));
  }

  function closeIcons() {
    setIconPickerOpen(false);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#07041c] text-white">
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-white/10 bg-[linear-gradient(180deg,rgba(26,18,48,0.96)_0%,rgba(14,9,28,0.94)_100%)] px-3 backdrop-blur-xl">
        <Link
          href={guest ? "/templates" : "/account"}
          className="flex shrink-0 items-center gap-2"
          aria-label={guest ? "Back to templates" : "Back to your account"}
        >
          <VezoraMark className="h-7 w-10" />
          <span className="hidden text-sm font-semibold tracking-[0.22em] sm:inline">VEZORA</span>
        </Link>
        <span className="hidden h-5 w-px shrink-0 bg-white/15 sm:block" aria-hidden="true" />
        <input
          aria-label="Project name"
          value={name}
          className="h-9 min-w-28 max-w-xs flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white outline-none placeholder:text-white/35 focus:border-[#c4b5fd]/55 focus:bg-white/[0.07]"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void rename(name)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <p className="shrink-0 text-xs text-white/55" role="status">
          {guest
            ? "Local session"
            : saveState === "saving"
              ? "Saving…"
              : saveState === "failed"
                ? "Not saved"
                : "Saved"}
        </p>
        {!guest && saveState === "failed" ? (
          <Button type="button" variant="outline" className={quiet} onClick={() => void persist(snapshot.revision)}>
            Retry
          </Button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={quiet}
            disabled={!snapshot.canUndo}
            onClick={() => void controllerRef.current?.undo()}
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            className={quiet}
            disabled={!snapshot.canRedo}
            onClick={() => void controllerRef.current?.redo()}
          >
            Redo
          </Button>
          <Button
            type="button"
            variant="outline"
            className={quiet}
            disabled={!snapshot.ready || Boolean(bootError)}
            onClick={() => setReconstruct({ open: true, intent: "upload" })}
          >
            Start from an image
          </Button>
          {sourceAssetId ? (
            <Button
              type="button"
              variant="outline"
              className={quiet}
              disabled={!snapshot.ready || Boolean(bootError)}
              onClick={() => setReconstruct({ open: true, intent: "elements" })}
            >
              Edit elements
            </Button>
          ) : null}
          <Button
            type="button"
            className={primary}
            disabled={!snapshot.ready || Boolean(bootError)}
            onClick={() => {
              if (!guest) {
                setExportOpen(true);
                return;
              }
              const slug = templateSlug || projectId.replace(/^guest:/, "");
              const document = controllerRef.current?.projectDocument() ?? documentRef.current;
              void buildGuestDraft({
                templateSlug: slug,
                projectName: nameRef.current,
                document,
                export: { format: "svg", scale: 1, background: "artboard" },
                openExport: true,
              }).then((draft) => {
                saveGuestDraft(draft);
                setExportAuthOpen(true);
              });
            }}
          >
            Export
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Toolbar
          iconPickerOpen={iconPickerOpen}
          selectionCount={snapshot.selectionCount}
          tool={snapshot.tool}
          onTool={(tool) => {
            closeIcons();
            void controllerRef.current?.setTool(tool);
          }}
          onCombine={(op) => {
            closeIcons();
            void controllerRef.current?.combine(op);
          }}
          onOffset={() => {
            closeIcons();
            void controllerRef.current?.offsetSelection();
          }}
          offsetDistance={snapshot.offsetDistance}
          onTextPath={() => {
            closeIcons();
            controllerRef.current?.textOnPath();
          }}
          onOutline={() => {
            closeIcons();
            void controllerRef.current?.outlineStroke();
          }}
          onTrace={() => {
            closeIcons();
            traceInputRef.current?.click();
          }}
          onImportSvg={() => {
            closeIcons();
            svgInputRef.current?.click();
          }}
          onAddText={() => {
            closeIcons();
            controllerRef.current?.addText();
          }}
          onAddRect={() => {
            closeIcons();
            controllerRef.current?.addRect();
          }}
          onAddEllipse={() => {
            closeIcons();
            controllerRef.current?.addEllipse();
          }}
          onAddLine={() => {
            closeIcons();
            controllerRef.current?.addLine();
          }}
          onAddCircle={() => {
            closeIcons();
            controllerRef.current?.addCircle();
          }}
          onAddRoundRect={() => {
            closeIcons();
            controllerRef.current?.addRoundRect();
          }}
          onAddTriangle={() => {
            closeIcons();
            controllerRef.current?.addTriangle();
          }}
          onAddRing={() => {
            closeIcons();
            controllerRef.current?.addRing();
          }}
          onAddArc={() => {
            closeIcons();
            controllerRef.current?.addArc();
          }}
          onAddStar={() => {
            closeIcons();
            controllerRef.current?.addStar();
          }}
          onToggleIcons={() => setIconPickerOpen((open) => !open)}
          onAddIcon={(iconId) => {
            closeIcons();
            void controllerRef.current?.addIcon(iconId);
          }}
          onAddImage={() => {
            closeIcons();
            imageInputRef.current?.click();
          }}
          onFlip={(axis) => controllerRef.current?.flip(axis)}
          onDuplicate={() => void controllerRef.current?.duplicate()}
          onDelete={() => controllerRef.current?.deleteSelection()}
        />
        <div className="relative flex min-w-0 flex-1">
          {sideBySide && sourceAssetId ? (
            <aside className="flex w-52 shrink-0 flex-col gap-2 border-r border-white/10 bg-[#100818]/95 p-3">
              <p className="text-sm font-medium text-white">Original</p>
              {/* The reconstruction upload is served only to the signed-in owner. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Original upload"
                src={uploadSrc(sourceAssetId)}
                className="w-full rounded-md border border-white/10"
              />
              <p className="text-xs leading-relaxed text-white/55">
                Exact upload for reference. Edit matching parts on the artboard beside it.
              </p>
            </aside>
          ) : null}
          <div className="relative min-w-0 flex-1">
          {sourceAssetId ? (
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className={cn(sideBySide ? primary : quiet)}
                aria-pressed={sideBySide}
                onClick={() => setSideBySide((open) => !open)}
              >
                Side by side
              </Button>
              {snapshot.keepShapes ? (
                <div
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-[#100818]/90 p-1 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.8)]"
                  role="group"
                  aria-label="Faint ring outlines under editable parts"
                  title={
                    snapshot.keepEdgeOutlines
                      ? "Holes under parts (clean move). Faint rings around parts may show."
                      : "Rings cleared and holes filled to match the artboard — moving a part leaves no dark punch."
                  }
                >
                  <span className="px-2 text-[11px] tracking-wide text-white/55 uppercase">Outlines</span>
                  <Button
                    type="button"
                    className={cn(
                      "h-8 rounded-full px-3 text-xs",
                      snapshot.keepEdgeOutlines ? primary : quiet,
                    )}
                    aria-pressed={snapshot.keepEdgeOutlines}
                    onClick={() => void controllerRef.current?.setKeepEdgeOutlines(true)}
                  >
                    Keep
                  </Button>
                  <Button
                    type="button"
                    className={cn(
                      "h-8 rounded-full px-3 text-xs",
                      !snapshot.keepEdgeOutlines ? primary : quiet,
                    )}
                    aria-pressed={!snapshot.keepEdgeOutlines}
                    onClick={() => void controllerRef.current?.setKeepEdgeOutlines(false)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={editorStage}>
            <canvas ref={canvasRef} />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
              className="hidden"
              aria-label="Place image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void placeUploadedImage(file);
              }}
            />
            <input
              ref={traceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/bmp,.png,.jpg,.jpeg,.gif,.bmp"
              className="hidden"
              aria-label="Trace image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void controllerRef.current?.traceFile(file);
              }}
            />
            <input
              ref={svgInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              aria-label="Import SVG"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void file.text().then((markup) => controllerRef.current?.importSvg(markup));
              }}
            />
          </div>
          {bootError ? (
            <div className="absolute inset-0 z-10 grid place-items-center gap-3 bg-[#07041c]/92 p-6 text-center">
              <p className="text-sm font-medium text-white">The canvas could not start.</p>
              <p className="max-w-sm text-sm text-white/60">{bootError}</p>
              <Button
                type="button"
                className={primary}
                onClick={() => {
                  setBootError(null);
                  setBootId((id) => id + 1);
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {!bootError && !snapshot.ready ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#07041c]/80 text-sm text-white/60">
              Opening the editor…
            </div>
          ) : null}
          {snapshot.error ? (
            <div
              role="alert"
              className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-[#100818] px-3 py-2 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
            >
              <span>{snapshot.error}</span>
              <Button
                type="button"
                variant="outline"
                className={quiet}
                onClick={() => controllerRef.current?.dismissError()}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
          </div>
        </div>
        <aside className="relative flex min-h-0 w-[19rem] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,rgba(22,12,40,0.98)_0%,rgba(10,6,20,0.98)_100%)] text-white shadow-[-24px_0_60px_rgba(0,0,0,0.28)] max-sm:w-52">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e9d5ff]/50 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-[#7c3aed]/18 blur-3xl"
          />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:thin]">
            <PropertiesPanel
              fonts={fonts}
              selection={snapshot.selection}
              selectionCount={snapshot.selectionCount}
              tool={snapshot.tool}
              offsetDistance={snapshot.offsetDistance}
              onOffsetDistance={(distance) => controllerRef.current?.setOffsetDistance(distance)}
              onPatch={(patch) => controllerRef.current?.updateSelection(patch)}
              onFlipPath={() => controllerRef.current?.flipPathSide()}
              onStraighten={() => controllerRef.current?.straightenText()}
              onDuplicate={() => void controllerRef.current?.duplicate()}
              onDelete={() => controllerRef.current?.deleteSelection()}
              onAlign={(edge) => controllerRef.current?.align(edge)}
              onDistribute={(axis) => controllerRef.current?.distribute(axis)}
            />
            <LayersPanel
              layers={snapshot.layers}
              onSelect={(id, additive) => controllerRef.current?.selectLayer(id, additive)}
              onReorder={(id, direction) => controllerRef.current?.reorder(id, direction)}
              onToggleVisible={(id) => controllerRef.current?.toggleVisible(id)}
              onToggleLocked={(id) => controllerRef.current?.toggleLocked(id)}
            />
          </div>
        </aside>
      </div>
      {reconstruct.open ? (
        <ReconstructDialog
          projectId={projectId}
          fonts={fonts}
          guest={guest}
          assetId={reconstruct.intent === "elements" ? sourceAssetId : null}
          intent={reconstruct.intent}
          onClose={() => setReconstruct({ open: false, intent: "upload" })}
          onApply={(next, hand) => {
            const sourceId =
              next.reconstruction?.sourceAssetId ??
              next.objects.find(
                (object) =>
                  object.type === "image" && (object.name === "Original" || object.name === "Logo"),
              )?.assetId ??
              null;
            // keepShapes docs must not be collapsed back to a single Logo on reopen.
            documentRef.current = next;
            pendingTool.current = hand ? "pen" : null;
            setSourceAssetId(sourceId);
            // Exact Logo / Draw missing / shapes: show the upload beside the board.
            const exactLogo =
              next.objects.length === 1 &&
              next.objects[0]?.type === "image" &&
              (next.objects[0]?.name === "Logo" || next.objects[0]?.name === "Original");
            setSideBySide(Boolean(sourceId && (hand || next.reconstruction?.keepShapes || exactLogo)));
            savedRevision.current = 0;
            setSaveState("saved");
            setReconstruct({ open: false, intent: "upload" });
            setBootId((id) => id + 1);
          }}
        />
      ) : null}
      {exportAuthOpen ? (
        <ExportAuthDialog
          templateSlug={templateSlug || projectId.replace(/^guest:/, "")}
          onClose={() => setExportAuthOpen(false)}
        />
      ) : null}
      {exportOpen ? (
        <ExportDialog
          projectId={projectId}
          projectName={name}
          onClose={() => setExportOpen(false)}
          onExport={(request) => {
            const controller = controllerRef.current;
            if (!controller) return Promise.reject(new Error("Export failed."));
            return controller.createExport(request);
          }}
        />
      ) : null}
      <EditorFooter
        zoom={snapshot.zoom}
        artboard={snapshot.artboard}
        snap={snapshot.snap}
        onZoomIn={() => controllerRef.current?.zoomBy(1.1)}
        onZoomOut={() => controllerRef.current?.zoomBy(1 / 1.1)}
        onFit={() => controllerRef.current?.fit()}
        onPreset={(presetId) => controllerRef.current?.setArtboardPreset(presetId)}
        onSize={(width, height) => controllerRef.current?.setArtboardSize(width, height)}
        onBackground={(background) => controllerRef.current?.setBackground(background)}
        onSnap={(enabled) => controllerRef.current?.setSnap(enabled)}
      />
    </div>
  );
}
