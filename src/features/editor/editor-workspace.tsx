"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VezoraMark } from "@/components/vezora-mark";
import { cn } from "@/lib/utils";
import { initialEditorSnapshot } from "@/features/editor/artboard";
import { CanvasController } from "@/features/editor/canvas-controller";
import { EditorFooter } from "@/features/editor/editor-footer";
import { ExportDialog } from "@/features/editor/export-dialog";
import { LayersPanel } from "@/features/editor/layers-panel";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import { Toolbar } from "@/features/editor/toolbar";
import { ReconstructDialog } from "@/features/reconstruction/reconstruct-dialog";
import type { ProjectDocument } from "@/features/projects/document";
import type { EditorFontOption, EditorSnapshot } from "@/features/editor/types";

const CHECKERBOARD = {
  backgroundColor: "#f3f1ec",
  backgroundImage:
    "linear-gradient(45deg, #e4e0d6 25%, transparent 25%), linear-gradient(-45deg, #e4e0d6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e0d6 75%), linear-gradient(-45deg, transparent 75%, #e4e0d6 75%)",
  backgroundSize: "24px 24px",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
} as const;

const quiet =
  "h-9 shrink-0 rounded-full border-[#d9d6e3] bg-white px-3 text-[#16141f] hover:bg-[#f4f2ec]";
const primary =
  "h-9 shrink-0 rounded-full bg-[#16141f] px-4 text-white hover:bg-[#2a2640]";

export function EditorWorkspace({
  projectId,
  projectName,
  document,
  fonts,
}: {
  projectId: string;
  projectName: string;
  document: ProjectDocument;
  fonts: EditorFontOption[];
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
  const [exportOpen, setExportOpen] = useState(false);
  const [reconstructOpen, setReconstructOpen] = useState(false);
  const [sourceAssetId, setSourceAssetId] = useState(document.reconstruction?.sourceAssetId ?? null);
  const [compare, setCompare] = useState<"overlay" | "side">("overlay");
  const pendingTool = useRef<"pen" | null>(null);
  const [name, setName] = useState(projectName);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const documentRef = useRef(document);
  const savedRevision = useRef(0);
  const savingRef = useRef(false);
  const pendingRevision = useRef<number | null>(null);

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
    if (savingRef.current) {
      pendingRevision.current = revision;
      return;
    }
    const controller = controllerRef.current;
    if (!controller) return;
    savingRef.current = true;
    setSaveState("saving");
    void fetch(`/api/projects/${projectId}/document`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document: controller.projectDocument(), source: "autosave" }),
    })
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
  }, [projectId]);

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
  }, [projectId, snapshot.ready, snapshot.revision]);

  async function rename(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === projectName) {
      setName(projectName);
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
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f4f2ec] text-[#16141f]">
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-[#e6e4ee] bg-white px-3">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Back to your logos">
          <VezoraMark className="h-7 w-10" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Vezora</span>
        </Link>
        <span className="hidden h-5 w-px shrink-0 bg-[#e6e4ee] sm:block" aria-hidden="true" />
        <input
          aria-label="Project name"
          value={name}
          className="h-9 min-w-28 max-w-xs flex-1 rounded-full border border-transparent bg-[#f5f6f8] px-3 text-sm font-medium outline-none focus:border-[#6d5bd0] focus:bg-white"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void rename(name)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <p className="shrink-0 text-xs text-[#16141f]/55" role="status">
          {saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved" : "Saved"}
        </p>
        {saveState === "failed" ? (
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
            onClick={() => setReconstructOpen(true)}
          >
            Start from an image
          </Button>
          <Button
            type="button"
            className={primary}
            disabled={!snapshot.ready || Boolean(bootError)}
            onClick={() => setExportOpen(true)}
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
          {compare === "side" && sourceAssetId ? (
            <aside className="flex w-52 shrink-0 flex-col gap-2 border-r border-[#e6e4ee] bg-white p-3">
              <p className="text-sm font-medium">Original</p>
              {/* The reconstruction upload is served only to the signed-in owner. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Original upload" src={`/api/uploads/${sourceAssetId}`} className="w-full rounded-md border" />
              <p className="text-xs text-muted-foreground">
                This is the uploaded file. The same image is the locked Original layer on the canvas.
              </p>
            </aside>
          ) : null}
          <div className="relative min-w-0 flex-1">
          {sourceAssetId ? (
            <div className="absolute top-3 left-3 z-20 flex gap-2">
              <Button type="button" className={cn(compare === "overlay" ? primary : quiet)} onClick={() => setCompare("overlay")}>
                Overlay
              </Button>
              <Button type="button" className={cn(compare === "side" ? primary : quiet)} onClick={() => setCompare("side")}>
                Side by side
              </Button>
            </div>
          ) : null}
          <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={CHECKERBOARD}>
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
            <div className="absolute inset-0 z-10 grid place-items-center gap-3 bg-[#f4f2ec]/90 p-6 text-center">
              <p className="text-sm font-medium">The canvas could not start.</p>
              <p className="max-w-sm text-sm text-muted-foreground">{bootError}</p>
              <Button
                type="button"
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
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f2ec]/80 text-sm text-[#16141f]/60">
              Opening the editor…
            </div>
          ) : null}
          {snapshot.error ? (
            <div
              role="alert"
              className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#e6e4ee] bg-white px-3 py-2 text-sm shadow-sm"
            >
              <span>{snapshot.error}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => controllerRef.current?.dismissError()}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
          </div>
        </div>
        <aside className="flex min-h-0 w-80 shrink-0 flex-col overflow-y-auto border-l border-[#e6e4ee] bg-white [scrollbar-width:thin] max-sm:w-52">
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
        </aside>
      </div>
      {reconstructOpen ? (
        <ReconstructDialog
          projectId={projectId}
          fonts={fonts}
          onClose={() => setReconstructOpen(false)}
          onApply={(next, hand) => {
            documentRef.current = next;
            pendingTool.current = hand ? "pen" : null;
            setSourceAssetId(next.reconstruction?.sourceAssetId ?? null);
            savedRevision.current = 0;
            setSaveState("saved");
            setReconstructOpen(false);
            setBootId((id) => id + 1);
          }}
        />
      ) : null}
      {exportOpen ? (
        <ExportDialog
          projectName={projectName}
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
