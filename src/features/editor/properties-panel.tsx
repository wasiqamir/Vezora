"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AlignEdge } from "@/features/editor/align";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelSelect } from "@/components/ui/panel-select";
import { ColorInput } from "@/features/editor/color-input";
import type { EditorFontOption, EditorTool, SelectionPatch, SelectionSnapshot } from "@/features/editor/types";

const WEIGHTS = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
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
  onPatch,
  onFlipPath,
  onStraighten,
  onDuplicate,
  onDelete,
}: PropertiesPanelProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-white/10 p-5 text-white">
      <div>
        <p className="text-[11px] tracking-[0.28em] text-white/40 uppercase">Inspect</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Style</h2>
      </div>

      {selectionCount === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-white/55">
          Select anything on the artboard to edit its look.
        </p>
      ) : null}

      {selectionCount > 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/60">{selectionCount} selected</p>
          <ActionRow onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
      ) : null}

      {selection ? (
        <div className="flex flex-col gap-5">
          {selection.type === "text" ? (
            <div className="flex flex-col gap-3.5">
              <Field label="Text">
                <textarea
                  value={selection.text ?? ""}
                  aria-label="Text"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus-visible:border-[#c4b5fd]/55 focus-visible:ring-3 focus-visible:ring-[#c4b5fd]/20"
                  onChange={(event) => onPatch({ text: event.target.value })}
                />
              </Field>
              <Field label="Font">
                <PanelSelect
                  ariaLabel="Font"
                  value={selection.fontId ?? "outfit"}
                  onChange={(value) => onPatch({ fontId: value })}
                  groups={fontGroups(fonts).map((group) => ({
                    category: group.category,
                    options: group.fonts.map((font) => ({ value: font.id, label: font.label })),
                  }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  resetKey={`${selection.id}:size`}
                  label="Size"
                  value={selection.fontSize ?? 72}
                  min={8}
                  max={500}
                  live
                  onCommit={(fontSize) => onPatch({ fontSize })}
                />
                <Field label="Weight">
                  <PanelSelect
                    ariaLabel="Weight"
                    value={String(selection.fontWeight ?? 500)}
                    onChange={(value) => onPatch({ fontWeight: Number(value) })}
                    options={WEIGHTS}
                  />
                </Field>
              </div>
              {selection.onPath ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                    disabled={selection.locked}
                    onClick={onFlipPath}
                  >
                    Flip path
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                    disabled={selection.locked}
                    onClick={onStraighten}
                  >
                    Straighten
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {selection.type === "line" ? null : (
              <ColorField
                label={selection.type === "image" ? "Color" : "Fill"}
                value={selection.fill}
                emptySwatch={selection.sourceColor ?? undefined}
                originalWhenEmpty={selection.type === "image"}
                onChange={(fill) => onPatch({ fill })}
              />
            )}
            {selection.type === "image" ? null : (
              <ColorField label="Stroke" value={selection.stroke} onChange={(stroke) => onPatch({ stroke })} />
            )}
          </div>

          {selection.stroke ? (
            <NumberField
              resetKey={`${selection.id}:stroke:${selection.strokeWidth}`}
              label="Stroke width"
              value={selection.strokeWidth}
              min={0}
              max={80}
              onCommit={(strokeWidth) => onPatch({ strokeWidth })}
            />
          ) : null}

          <Field label={`Opacity ${Math.round(selection.opacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              aria-label="Opacity"
              className="w-full accent-[#c4b5fd]"
              value={Math.round(selection.opacity * 100)}
              onChange={(event) => onPatch({ opacity: Number(event.target.value) / 100 })}
            />
          </Field>

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
      <Button
        type="button"
        variant="outline"
        className="flex-1 rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
        onClick={onDuplicate}
      >
        Duplicate
      </Button>
      <Button type="button" variant="destructive" className="flex-1 rounded-full" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] tracking-[0.14em] text-white/45 uppercase">
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

function ColorField({
  label,
  value,
  onChange,
  originalWhenEmpty = false,
  emptySwatch,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Image pieces: empty means original pixels; keep the picker enabled. */
  originalWhenEmpty?: boolean;
  /** Swatch shown when value is empty (sampled piece color). */
  emptySwatch?: string;
}) {
  const empty = value === null;
  return (
    <Field label={label}>
      <span className="flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-2">
        <ColorInput
          aria-label={`${label} color`}
          className="size-7"
          value={value ?? emptySwatch ?? (originalWhenEmpty ? "#c45c7a" : "#171717")}
          disabled={empty && !originalWhenEmpty}
          onChange={onChange}
        />
        <button
          type="button"
          className="text-[11px] tracking-normal text-white/55 normal-case hover:text-white disabled:opacity-40"
          disabled={originalWhenEmpty && empty}
          onClick={() => {
            if (originalWhenEmpty) {
              if (!empty) onChange(null);
              return;
            }
            onChange(empty ? "#171717" : null);
          }}
        >
          {originalWhenEmpty ? (empty ? "Original" : "Reset") : empty ? "Off" : "None"}
        </button>
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
  live = false,
  onCommit,
}: {
  resetKey: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Apply as digits are typed (no Enter / blur needed). */
  live?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focusedRef = useRef(false);

  // Sync from the canvas when selection changes — not while the user is mid-typing.
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [resetKey, value]);

  const clampNumber = (next: number) =>
    Math.min(max ?? next, Math.max(min ?? next, Math.round(next)));

  const commit = (raw: string, { force }: { force: boolean }) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      if (force) setDraft(String(value));
      return;
    }
    const next = Number(trimmed);
    if (!Number.isFinite(next)) {
      if (force) setDraft(String(value));
      return;
    }
    const clamped = clampNumber(next);
    if (force) setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <Field label={label}>
      <Input
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        className="h-10 rounded-xl border-white/12 bg-white/[0.04] text-sm tracking-normal text-white normal-case"
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          // Allow clearing / partial digits while typing.
          if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
          setDraft(raw);
          if (live) commit(raw, { force: false });
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit(draft, { force: true });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </Field>
  );
}
