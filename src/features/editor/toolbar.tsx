"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Baseline,
  Blend,
  Circle,
  CircleDot,
  Copy,
  FileUp,
  Image as ImageIcon,
  Merge,
  Minus,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  PenTool,
  ScanLine,
  Scissors,
  Shapes,
  Spline,
  Square,
  SquareDashed,
  Squircle,
  Star,
  Trash2,
  Triangle,
  Type,
  UnfoldHorizontal,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOGO_ICONS } from "@/features/editor/icons";
import type { CombineOp } from "@/features/editor/path-ops";
import type { EditorTool } from "@/features/editor/types";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  iconPickerOpen: boolean;
  selectionCount: number;
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
  onCombine: (op: CombineOp) => void;
  onOffset: () => void;
  offsetDistance: number;
  onTextPath: () => void;
  onOutline: () => void;
  onTrace: () => void;
  onImportSvg: () => void;
  onAddText: () => void;
  onAddRect: () => void;
  onAddRoundRect: () => void;
  onAddEllipse: () => void;
  onAddCircle: () => void;
  onAddTriangle: () => void;
  onAddRing: () => void;
  onAddArc: () => void;
  onAddStar: () => void;
  onAddLine: () => void;
  onToggleIcons: () => void;
  onAddIcon: (iconId: string) => void;
  onAddImage: () => void;
  onFlip: (axis: "x" | "y") => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function Toolbar({
  iconPickerOpen,
  selectionCount,
  tool,
  onTool,
  onCombine,
  onOffset,
  offsetDistance,
  onTextPath,
  onOutline,
  onTrace,
  onImportSvg,
  onAddText,
  onAddRect,
  onAddRoundRect,
  onAddEllipse,
  onAddCircle,
  onAddTriangle,
  onAddRing,
  onAddArc,
  onAddStar,
  onAddLine,
  onToggleIcons,
  onAddIcon,
  onAddImage,
  onFlip,
  onDuplicate,
  onDelete,
}: ToolbarProps) {
  const hasSelection = selectionCount > 0;

  return (
    <div className="flex min-h-0 w-[9.25rem] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#e6e4ee] bg-white px-2 py-3 [scrollbar-width:thin]">
      <ToolGroup label="Draw">
        <ToolButton label="Select" purpose="Move, resize, or rotate what is on the canvas." icon={<MousePointer2 />} pressed={tool === "select"} onClick={() => onTool("select")} />
        <ToolButton
          label="Pen"
          purpose="Draw an outline. Click points, then click the start to close."
          icon={<PenTool />}
          pressed={tool === "pen"}
          onClick={() => onTool("pen")}
        />
        <ToolButton
          label="Nodes"
          purpose="Drag the points of one outline."
          icon={<Waypoints />}
          pressed={tool === "nodes"}
          onClick={() => onTool("nodes")}
        />
      </ToolGroup>
      <ToolGroup label="Add">
        <ToolButton label="Text" purpose="Add a word or a name." icon={<Type />} onClick={onAddText} />
        <ToolButton label="Circle" purpose="Add a circle for a head, eye, or button." icon={<Circle />} onClick={onAddCircle} />
        <ToolButton label="Round" purpose="Add a rectangle with soft corners." icon={<Squircle />} onClick={onAddRoundRect} />
        <ToolButton label="Rect" purpose="Add a square or a rectangle." icon={<Square />} onClick={onAddRect} />
        <ToolButton label="Ellipse" purpose="Add a stretched circle." icon={<Circle className="scale-x-125 scale-y-75" />} onClick={onAddEllipse} />
        <ToolButton label="Triangle" purpose="Add a triangle for an ear, beak, or leaf." icon={<Triangle />} onClick={onAddTriangle} />
        <ToolButton label="Arc" purpose="Add a curve for a smile or a brow." icon={<Spline />} onClick={onAddArc} />
        <ToolButton label="Ring" purpose="Add a hollow circle." icon={<CircleDot />} onClick={onAddRing} />
        <ToolButton label="Star" purpose="Add a star or a badge point." icon={<Star />} onClick={onAddStar} />
        <ToolButton label="Line" purpose="Add a straight line." icon={<Minus />} onClick={onAddLine} />
        <div className="relative">
          <ToolButton
            label="Icon"
            purpose="Place a simple symbol."
            icon={<Shapes />}
            pressed={iconPickerOpen}
            onClick={onToggleIcons}
          />
          {iconPickerOpen ? (
            <div className="absolute top-0 left-full z-20 ml-2 w-56 rounded-2xl border border-[#e6e4ee] bg-white p-2 shadow-[0_16px_40px_rgba(22,20,31,0.12)]">
              <p className="px-1 text-xs font-medium">Icons</p>
              <p className="px-1 pb-2 text-[11px] text-muted-foreground">
                Simple symbols. Draw a character from the shapes.
              </p>
              <div className="grid grid-cols-4 gap-1">
                {LOGO_ICONS.map((icon) => (
                  <HoverTip key={icon.id} purpose={`Add the ${icon.name} symbol.`}>
                  <button
                    type="button"
                    className="grid aspect-square w-full place-items-center rounded-lg border hover:bg-muted"
                    aria-label={`Add the ${icon.name} symbol.`}
                    onClick={() => onAddIcon(icon.id)}
                  >
                    <svg viewBox="0 0 100 100" className="size-8" aria-hidden="true">
                      {icon.paths.map((path) => (
                        <path key={path.d} d={path.d} fill="currentColor" fillRule={path.rule} />
                      ))}
                    </svg>
                  </button>
                  </HoverTip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <ToolButton label="Image" purpose="Place a PNG, JPG, or SVG." icon={<ImageIcon />} onClick={onAddImage} />
      </ToolGroup>
      <ToolGroup label="Combine">
        <ToolButton
          label="Unite"
          purpose="Merge the selected shapes into one."
          icon={<Merge />}
          disabled={selectionCount < 2}
          onClick={() => onCombine("unite")}
        />
        <ToolButton
          label="Subtract"
          purpose="Cut the front shapes out of the back shape."
          icon={<Scissors />}
          disabled={selectionCount < 2}
          onClick={() => onCombine("subtract")}
        />
        <ToolButton
          label="Intersect"
          purpose="Keep only where the shapes overlap."
          icon={<Blend />}
          disabled={selectionCount < 2}
          onClick={() => onCombine("intersect")}
        />
        <ToolButton
          label="Offset"
          purpose={`Copy the shape ${offsetDistance}px larger or smaller.`}
          icon={<UnfoldHorizontal />}
          disabled={!hasSelection}
          onClick={onOffset}
        />
        <ToolButton
          label="On path"
          purpose="Bend a word along a shape."
          icon={<Baseline />}
          disabled={!hasSelection}
          onClick={onTextPath}
        />
        <ToolButton
          label="Outline"
          purpose="Turn a stroke into a filled shape."
          icon={<SquareDashed />}
          disabled={!hasSelection}
          onClick={onOutline}
        />
      </ToolGroup>
      <ToolGroup label="Bring in">
        <ToolButton
          label="Trace"
          purpose="Turn a picture into shapes."
          icon={<ScanLine />}
          onClick={onTrace}
        />
        <ToolButton
          label="SVG"
          purpose="Bring in shapes from an SVG file."
          icon={<FileUp />}
          onClick={onImportSvg}
        />
      </ToolGroup>
      <ToolGroup label="Arrange">
        <ToolButton
          label="Flip H"
          purpose="Mirror the selection left to right."
          icon={<MoveHorizontal />}
          disabled={!hasSelection}
          onClick={() => onFlip("x")}
        />
        <ToolButton
          label="Flip V"
          purpose="Mirror the selection top to bottom."
          icon={<MoveVertical />}
          disabled={!hasSelection}
          onClick={() => onFlip("y")}
        />
        <ToolButton
          label="Duplicate"
          purpose="Make a copy of the selection."
          icon={<Copy />}
          disabled={!hasSelection}
          onClick={onDuplicate}
        />
        <ToolButton
          label="Delete"
          purpose="Remove the selection."
          icon={<Trash2 />}
          disabled={!hasSelection}
          onClick={onDelete}
        />
      </ToolGroup>
    </div>
  );
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <p className="px-1 text-[10px] font-medium tracking-[0.14em] text-[#6d5bd0] uppercase">{label}</p>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </section>
  );
}

function ToolButton({
  label,
  purpose,
  icon,
  onClick,
  pressed = false,
  disabled = false,
}: {
  label: string;
  purpose: string;
  icon: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <HoverTip purpose={purpose}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-auto w-full flex-col gap-1 rounded-xl px-1 py-1.5 text-[11px] leading-none font-medium whitespace-normal text-[#16141f] hover:bg-[#f4f2ec] [&_svg]:size-4",
          pressed && "bg-[#16141f] text-white hover:bg-[#2a2640]",
        )}
        aria-pressed={pressed}
        aria-label={`${label}. ${purpose}`}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
        {label}
      </Button>
    </HoverTip>
  );
}

function HoverTip({ purpose, children }: { purpose: string; children: ReactNode }) {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  function place(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    setTip({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  return (
    <span
      className="block"
      onMouseEnter={(event) => place(event.currentTarget)}
      onMouseLeave={() => setTip(null)}
    >
      {children}
      {tip
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 max-w-56 -translate-y-1/2 rounded-xl border border-[#e6e4ee] bg-white px-2.5 py-1.5 text-left text-xs leading-snug text-[#16141f] shadow-md"
              style={{ top: tip.top, left: tip.left }}
            >
              {purpose}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
