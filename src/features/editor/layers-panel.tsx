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
    <section className="flex flex-col gap-2 p-4">
      <h2 className="text-xs font-medium tracking-[0.16em] text-[#6d5bd0] uppercase">Layers</h2>
      <p className="text-xs text-muted-foreground">The top of the list is in front.</p>
      <p className="text-xs text-muted-foreground">
        Ctrl+Z undoes. Arrows nudge. Shift moves 10px.
      </p>
      {layers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No layers yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {layers.map((layer, index) => (
            <li key={layer.id} className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm",
                  layer.selected ? "bg-[#efeafc] font-medium text-[#16141f]" : "hover:bg-[#f4f2ec]",
                  layer.visible ? "" : "text-muted-foreground",
                )}
                onClick={(event) => onSelect(layer.id, event.shiftKey)}
              >
                {layer.name}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
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
