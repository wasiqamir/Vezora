"use client";

import type { ReactNode } from "react";
import { AlignControls } from "@/features/editor/align-controls";
import type { AlignEdge } from "@/features/editor/align";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EditorFontOption, EditorTool, SelectionPatch, SelectionSnapshot } from "@/features/editor/types";

const WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];

type PropertiesPanelProps = {
  fonts: EditorFontOption[];
  selection: SelectionSnapshot | null;
  selectionCount: number;
  tool: EditorTool;
  offsetDistance: number;
  onOffsetDistance: (distance: number) => void;
  onPatch: (patch: SelectionPatch) => void;
  onFlipPath: () => void;
  onStraighten: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
};

export function PropertiesPanel({
  fonts,
  selection,
  selectionCount,
  tool,
  offsetDistance,
  onOffsetDistance,
  onPatch,
  onFlipPath,
  onStraighten,
  onDuplicate,
  onDelete,
  onAlign,
  onDistribute,
}: PropertiesPanelProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#e6e4ee] p-4">
      <h2 className="text-xs font-medium tracking-[0.16em] text-[#6d5bd0] uppercase">Properties</h2>
      <NumberField
        resetKey={`offset:${offsetDistance}`}
        label="Offset"
        value={offsetDistance}
        min={-400}
        max={400}
        onCommit={onOffsetDistance}
      />
      <p className="text-xs text-muted-foreground">
        Positive grows the Offset copy. Negative shrinks it.
      </p>
      {tool === "pen" ? (
        <p className="text-sm text-muted-foreground">
          Click to add points. Drag to curve a point. Click the first point to close. Enter finishes, Escape cancels.
        </p>
      ) : null}
      {tool === "nodes" ? (
        <p className="text-sm text-muted-foreground">Drag a point. The curves on either side keep their shape.</p>
      ) : null}
      {selectionCount > 1 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{selectionCount} objects selected.</p>
          <ActionRow onDuplicate={onDuplicate} onDelete={onDelete} />
          <AlignControls
            count={selectionCount}
            disabled={false}
            onAlign={onAlign}
            onDistribute={onDistribute}
          />
        </div>
      ) : null}
      {selectionCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Build the mark yourself. Add a shape, duplicate it, and flip it to mirror a side. On path bends a word along a shape. Outline turns a stroke into a shape. Trace and SVG bring a drawing in.
        </p>
      ) : null}
      {selection ? (
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <Input
              value={selection.name}
              aria-label="Name"
              onChange={(event) => onPatch({ name: event.target.value })}
            />
          </Field>
          {selection.locked ? (
            <p className="text-xs text-muted-foreground">
              Locked. Unlock it in the layers list to move it.
            </p>
          ) : null}
          {selection.type === "text" ? (
            <div className="flex flex-col gap-3">
              <Field label="Text">
                <textarea
                  value={selection.text ?? ""}
                  aria-label="Text"
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onChange={(event) => onPatch({ text: event.target.value })}
                />
              </Field>
              <Field label="Font">
                <Select
                  ariaLabel="Font"
                  value={selection.fontId ?? "outfit"}
                  onChange={(value) => onPatch({ fontId: value })}
                >
                  {fontGroups(fonts).map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.fonts.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  resetKey={`${selection.id}:size:${selection.fontSize}`}
                  label="Size"
                  value={selection.fontSize ?? 72}
                  min={8}
                  max={500}
                  onCommit={(fontSize) => onPatch({ fontSize })}
                />
                <Field label="Weight">
                  <Select
                    ariaLabel="Weight"
                    value={String(selection.fontWeight ?? 500)}
                    onChange={(value) => onPatch({ fontWeight: Number(value) })}
                  >
                    {WEIGHTS.map((weight) => (
                      <option key={weight.value} value={weight.value}>
                        {weight.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {selection.onPath ? (
                <div className="flex flex-col gap-2">
                  <NumberField
                    resetKey={`${selection.id}:path:${selection.pathStartOffset ?? 0}`}
                    label="Path start"
                    value={selection.pathStartOffset ?? 0}
                    min={-2000}
                    max={2000}
                    disabled={selection.locked}
                    onCommit={(pathStartOffset) => onPatch({ pathStartOffset })}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={selection.locked} onClick={onFlipPath}>
                      Flip side
                    </Button>
                    <Button type="button" variant="outline" disabled={selection.locked} onClick={onStraighten}>
                      Straighten
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {selection.type === "line" ? null : (
            <ColorField
              label="Fill"
              value={selection.fill}
              onChange={(fill) => onPatch({ fill })}
            />
          )}
          <ColorField
            label="Stroke"
            value={selection.stroke}
            onChange={(stroke) => onPatch({ stroke })}
          />
          <NumberField
            resetKey={`${selection.id}:stroke:${selection.strokeWidth}`}
            label="Stroke width"
            value={selection.strokeWidth}
            min={0}
            max={80}
            onCommit={(strokeWidth) => onPatch({ strokeWidth })}
          />
          {selection.type === "rect" ? (
            <NumberField
              resetKey={`${selection.id}:corner:${selection.cornerRadius ?? 0}`}
              label="Corner"
              value={selection.cornerRadius ?? 0}
              min={0}
              max={400}
              onCommit={(cornerRadius) => onPatch({ cornerRadius })}
            />
          ) : null}
          <Field label={`Opacity ${Math.round(selection.opacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              aria-label="Opacity"
              value={Math.round(selection.opacity * 100)}
              onChange={(event) => onPatch({ opacity: Number(event.target.value) / 100 })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              resetKey={`${selection.id}:x:${selection.x}`}
              label="X"
              value={selection.x}
              disabled={selection.locked}
              onCommit={(x) => onPatch({ x })}
            />
            <NumberField
              resetKey={`${selection.id}:y:${selection.y}`}
              label="Y"
              value={selection.y}
              disabled={selection.locked}
              onCommit={(y) => onPatch({ y })}
            />
            <NumberField
              resetKey={`${selection.id}:w:${selection.width}`}
              label="W"
              value={selection.width}
              min={1}
              disabled={selection.locked}
              onCommit={(width) => onPatch({ width })}
            />
            <NumberField
              resetKey={`${selection.id}:h:${selection.height}`}
              label="H"
              value={selection.height}
              min={1}
              disabled={selection.locked}
              onCommit={(height) => onPatch({ height })}
            />
          </div>
          <NumberField
            resetKey={`${selection.id}:angle:${selection.angle}`}
            label="Rotation"
            value={selection.angle}
            disabled={selection.locked}
            onCommit={(angle) => onPatch({ angle })}
          />
          <AlignControls
            count={selectionCount}
            disabled={selection.locked}
            onAlign={onAlign}
            onDistribute={onDistribute}
          />
          <ActionRow onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
      ) : null}
    </div>
  );
}

function ActionRow({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button type="button" variant="destructive" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function fontGroups(fonts: EditorFontOption[]) {
  const groups: { category: string; fonts: EditorFontOption[] }[] = [];
  for (const font of fonts) {
    const current = groups.at(-1);
    if (current?.category === font.category) current.fonts.push(font);
    else groups.push({ category: font.category, fonts: [font] });
  }
  return groups;
}

function Select({
  ariaLabel,
  value,
  onChange,
  children,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color`}
          value={value ?? "#171717"}
          disabled={value === null}
          className="size-8 cursor-pointer rounded border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
          onChange={(event) => onChange(event.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={value === null}
            onChange={(event) => onChange(event.target.checked ? null : "#171717")}
          />
          None
        </label>
      </span>
    </Field>
  );
}

function NumberField({
  resetKey,
  label,
  value,
  min,
  max,
  disabled = false,
  onCommit,
}: {
  resetKey: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        key={resetKey}
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        defaultValue={String(value)}
        onBlur={(event) => {
          const next = Number(event.currentTarget.value);
          if (!Number.isFinite(next)) {
            event.currentTarget.value = String(value);
            return;
          }
          const clamped = Math.min(max ?? next, Math.max(min ?? next, Math.round(next)));
          event.currentTarget.value = String(clamped);
          if (clamped !== value) onCommit(clamped);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </Field>
  );
}
