"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARTBOARD_MAX, ARTBOARD_MIN, ARTBOARD_PRESETS } from "@/features/editor/artboard";
import type { ArtboardState } from "@/features/editor/types";

const quiet = "h-9 rounded-full border-[#d9d6e3] bg-white px-3 text-[#16141f] hover:bg-[#f4f2ec]";

type EditorFooterProps = {
  zoom: number;
  artboard: ArtboardState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onPreset: (presetId: (typeof ARTBOARD_PRESETS)[number]["id"]) => void;
  onSize: (width: number, height: number) => void;
  onBackground: (background: string | null) => void;
  snap: boolean;
  onSnap: (enabled: boolean) => void;
};

export function EditorFooter({
  zoom,
  artboard,
  onZoomIn,
  onZoomOut,
  onFit,
  onPreset,
  onSize,
  onBackground,
  snap,
  onSnap,
}: EditorFooterProps) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#e6e4ee] bg-white px-3 py-2 text-sm text-[#16141f]">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" className={quiet} aria-label="Zoom out" onClick={onZoomOut}>
          −
        </Button>
        <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button type="button" variant="outline" className={quiet} aria-label="Zoom in" onClick={onZoomIn}>
          +
        </Button>
        <Button type="button" variant="outline" className={quiet} onClick={onFit}>
          Fit
        </Button>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={snap}
          onChange={(event) => onSnap(event.target.checked)}
        />
        Snap
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[#16141f]/55">Artboard</span>
        <select
          aria-label="Artboard preset"
          value={artboard.presetId}
          className="h-9 rounded-full border border-[#d9d6e3] bg-white px-3"
          onChange={(event) => {
            const presetId = event.target.value;
            if (presetId === "custom") return;
            onPreset(presetId as (typeof ARTBOARD_PRESETS)[number]["id"]);
          }}
        >
          {ARTBOARD_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} {preset.width}×{preset.height}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>
      <SizeFields width={artboard.width} height={artboard.height} onSize={onSize} />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[#16141f]/55">Background</span>
        <input
          type="color"
          aria-label="Artboard background"
          value={artboard.background ?? "#ffffff"}
          disabled={artboard.background === null}
          className="size-8 cursor-pointer rounded-lg border border-[#d9d6e3] bg-transparent disabled:opacity-40"
          onChange={(event) => onBackground(event.target.value)}
        />
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={artboard.background === null}
            onChange={(event) => onBackground(event.target.checked ? null : "#ffffff")}
          />
          Transparent
        </label>
      </label>
    </footer>
  );
}

function SizeFields({
  width,
  height,
  onSize,
}: {
  width: number;
  height: number;
  onSize: (width: number, height: number) => void;
}) {
  function commit(nextWidth: number, nextHeight: number) {
    if (nextWidth !== width || nextHeight !== height) onSize(nextWidth, nextHeight);
  }

  return (
    <div className="flex items-center gap-1" title="Changing the artboard size does not move objects.">
      <Input
        key={`w-${width}`}
        className="h-9 w-16 rounded-full border-[#d9d6e3] px-2"
        inputMode="numeric"
        aria-label="Artboard width"
        defaultValue={String(width)}
        onBlur={(event) => {
          const nextWidth = clampEdge(Number(event.currentTarget.value), width);
          event.currentTarget.value = String(nextWidth);
          commit(nextWidth, height);
        }}
      />
      <span className="text-muted-foreground">×</span>
      <Input
        key={`h-${height}`}
        className="h-9 w-16 rounded-full border-[#d9d6e3] px-2"
        inputMode="numeric"
        aria-label="Artboard height"
        defaultValue={String(height)}
        onBlur={(event) => {
          const nextHeight = clampEdge(Number(event.currentTarget.value), height);
          event.currentTarget.value = String(nextHeight);
          commit(width, nextHeight);
        }}
      />
    </div>
  );
}

function clampEdge(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, Math.round(value)));
}
