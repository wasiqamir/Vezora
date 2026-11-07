"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARTBOARD_MAX, ARTBOARD_MIN, ARTBOARD_PRESETS } from "@/features/editor/artboard";
import { ColorInput } from "@/features/editor/color-input";
import { editorQuiet } from "@/features/editor/editor-theme";
import type { ArtboardState } from "@/features/editor/types";

const quiet = editorQuiet;
const field =
  "h-9 rounded-lg border border-white/15 bg-[#100818]/90 text-sm text-white outline-none transition focus:border-[#c4b5fd]/45";
const label = "text-[11px] tracking-[0.16em] text-white/45 uppercase";
const divider = "hidden h-5 w-px shrink-0 bg-white/12 sm:block";
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' stroke='%23ffffff' stroke-opacity='0.7' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
const CHEVRON_PAD = 28;

function presetLabel(presetId: ArtboardState["presetId"]) {
  if (presetId === "custom") return "Custom";
  const preset = ARTBOARD_PRESETS.find((item) => item.id === presetId);
  return preset ? `${preset.label} ${preset.width}×${preset.height}` : "Custom";
}

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
    <footer className="relative shrink-0 border-t border-white/10 bg-[linear-gradient(0deg,rgba(26,18,48,0.97)_0%,rgba(10,6,22,0.96)_100%)] text-sm text-white backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-[#e9d5ff]/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 h-16 w-[42%] -translate-x-1/2 bg-[#7c3aed]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 left-[18%] h-12 w-40 bg-[#67e8f9]/15 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 right-[18%] h-12 w-40 bg-[#ea580c]/18 blur-2xl"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            className={`${quiet} size-9 px-0`}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            −
          </Button>
          <span className="min-w-11 text-center text-sm font-medium text-white/90 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            className={`${quiet} size-9 px-0`}
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            +
          </Button>
          <Button type="button" variant="outline" className={quiet} onClick={onFit}>
            Fit
          </Button>
        </div>

        <span aria-hidden="true" className={divider} />

        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={snap}
            className="size-3.5 accent-[#67e8f9]"
            onChange={(event) => onSnap(event.target.checked)}
          />
          <span className="text-white/85">Snap</span>
        </label>

        <span aria-hidden="true" className={divider} />

        <div className="flex flex-wrap items-center gap-2.5">
          <span className={label}>Artboard</span>
          <PresetSelect value={artboard.presetId} onPreset={onPreset} />
          <SizeFields width={artboard.width} height={artboard.height} onSize={onSize} />
        </div>

        <span aria-hidden="true" className={divider} />

        <div className="flex flex-wrap items-center gap-2.5">
          <span className={label}>Background</span>
          <ColorInput
            aria-label="Artboard background"
            value={artboard.background ?? "#ffffff"}
            disabled={artboard.background === null}
            onChange={onBackground}
          />
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              className="size-3.5 accent-[#fdba74]"
              checked={artboard.background === null}
              onChange={(event) => onBackground(event.target.checked ? null : "#ffffff")}
            />
            <span className="text-white/85">Transparent</span>
          </label>
        </div>
      </div>
    </footer>
  );
}

function PresetSelect({
  value,
  onPreset,
}: {
  value: ArtboardState["presetId"];
  onPreset: (presetId: (typeof ARTBOARD_PRESETS)[number]["id"]) => void;
}) {
  const text = presetLabel(value);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const next = measureRef.current?.offsetWidth;
    if (next) setWidth(next + CHEVRON_PAD);
  }, [text]);

  return (
    <span className="relative inline-flex">
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 -z-10 whitespace-nowrap opacity-0 pl-2.5 text-sm"
      >
        {text}
      </span>
      <select
        aria-label="Artboard preset"
        value={value}
        className={`${field} appearance-none bg-[length:12px_12px] bg-no-repeat py-0 pr-7 pl-2.5`}
        style={{
          width: width ? `${width}px` : undefined,
          backgroundImage: chevron,
          backgroundPosition: "right 0.45rem center",
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "custom") return;
          onPreset(next as (typeof ARTBOARD_PRESETS)[number]["id"]);
        }}
      >
        {ARTBOARD_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label} {preset.width}×{preset.height}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
    </span>
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
    <div className="flex items-center gap-1.5" title="Changing the artboard size does not move objects.">
      <Input
        key={`w-${width}`}
        className="h-9 w-16 rounded-lg border-white/15 bg-white/[0.04] px-2 text-center text-white"
        inputMode="numeric"
        aria-label="Artboard width"
        defaultValue={String(width)}
        onBlur={(event) => {
          const nextWidth = clampEdge(Number(event.currentTarget.value), width);
          event.currentTarget.value = String(nextWidth);
          commit(nextWidth, height);
        }}
      />
      <span className="text-white/40">×</span>
      <Input
        key={`h-${height}`}
        className="h-9 w-16 rounded-lg border-white/15 bg-white/[0.04] px-2 text-center text-white"
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
