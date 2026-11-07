"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LayerSnapshot } from "@/features/editor/types";
import { cn } from "@/lib/utils";

type LayersPanelProps = {
  layers: LayerSnapshot[];
  onSelect: (id: string, additive: boolean) => void;
  onReorder: (id: string, direction: "forward" | "backward") => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
};

export function LayersPanel({
  layers,
  onSelect,
  onReorder,
  onToggleVisible,
  onToggleLocked,
}: LayersPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div>
        <p className="text-[11px] tracking-[0.28em] text-white/40 uppercase">Stack</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Layers</h2>
      </div>

      {layers.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
          Layers appear here as you add marks.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              className={cn(
                "group flex items-center gap-1 rounded-2xl border px-1.5 py-1.5 transition-colors",
                layer.selected
                  ? "border-white/20 bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
              )}
            >
              <button
                type="button"
                className={cn(
                  "min-w-0 flex-1 truncate rounded-xl px-2.5 py-1.5 text-left text-sm",
                  layer.selected ? "font-medium text-white" : "text-white/80",
                  layer.visible ? "" : "text-white/35",
                )}
                onClick={(event) => onSelect(layer.id, event.shiftKey)}
              >
                {layer.name}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-white/45 opacity-70 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                aria-label={`Bring ${layer.name} forward`}
                disabled={index === 0}
                onClick={() => onReorder(layer.id, "forward")}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-white/45 opacity-70 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                aria-label={`Send ${layer.name} backward`}
                disabled={index === layers.length - 1}
                onClick={() => onReorder(layer.id, "backward")}
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-white/45 hover:bg-white/10 hover:text-white"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                aria-pressed={!layer.visible}
                onClick={() => onToggleVisible(layer.id)}
              >
                {layer.visible ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-white/45 hover:bg-white/10 hover:text-white"
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                aria-pressed={layer.locked}
                onClick={() => onToggleLocked(layer.id)}
              >
                {layer.locked ? <Lock /> : <LockOpen />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
