"use client";

import { Button } from "@/components/ui/button";
import type { AlignEdge } from "@/features/editor/align";

const EDGES: { edge: AlignEdge; label: string }[] = [
  { edge: "left", label: "Align left" },
  { edge: "center", label: "Align center" },
  { edge: "right", label: "Align right" },
  { edge: "top", label: "Align top" },
  { edge: "middle", label: "Align middle" },
  { edge: "bottom", label: "Align bottom" },
];

export function AlignControls({
  count,
  disabled,
  onAlign,
  onDistribute,
}: {
  count: number;
  disabled: boolean;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs text-white/55">Align to artboard</h3>
      <div className="grid grid-cols-3 gap-1">
        {EDGES.map((item) => (
          <Button
            key={item.edge}
            type="button"
            variant="outline"
            className="border-white/15 bg-white/[0.04] px-1 text-xs text-white/85 hover:bg-white/10 hover:text-white"
            disabled={disabled}
            onClick={() => onAlign(item.edge)}
          >
            {item.label.replace("Align ", "")}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant="outline"
          className="border-white/15 bg-white/[0.04] px-1 text-xs text-white/85 hover:bg-white/10 hover:text-white"
          disabled={disabled || count < 3}
          onClick={() => onDistribute("horizontal")}
        >
          Distribute H
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/15 bg-white/[0.04] px-1 text-xs text-white/85 hover:bg-white/10 hover:text-white"
          disabled={disabled || count < 3}
          onClick={() => onDistribute("vertical")}
        >
          Distribute V
        </Button>
      </div>
    </div>
  );
}
