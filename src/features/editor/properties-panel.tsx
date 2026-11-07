"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlignControls } from "@/features/editor/align-controls";
import type { AlignEdge } from "@/features/editor/align";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelSelect } from "@/components/ui/panel-select";
import { ColorInput } from "@/features/editor/color-input";
import {
  ORIGINAL_WORD_FONT_ID,
  type EditorFontOption,
  type EditorTool,
  type SelectionPatch,
  type SelectionSnapshot,
} from "@/features/editor/types";

const quiet =
  "rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white";

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
    <div className="flex flex-col gap-5 border-b border-white/10 p-5 text-white">
      <div>
        <p className="text-[11px] tracking-[0.28em] text-white/40 uppercase">Inspect</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Style</h2>
      </div>

      <NumberField
        resetKey={`offset:${offsetDistance}`}
        label="Offset"
        value={offsetDistance}
        min={-400}
        max={400}
        onCommit={onOffsetDistance}
      />
      <p className="text-xs leading-relaxed text-white/45">
        Positive grows the Offset copy. Negative shrinks it.
      </p>

      {tool === "pen" ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/55">
          Click to add points. Drag to curve a point. Click the first point to close. Enter finishes, Escape cancels.
        </p>
      ) : null}
      {tool === "nodes" ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/55">
          Drag a point. The curves on either side keep their shape.
        </p>
      ) : null}

      {selectionCount === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-white/55">
          Select anything on the artboard to edit its look.
        </p>
      ) : null}

      {selectionCount > 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/60">{selectionCount} selected</p>
          <ActionRow onDuplicate={onDuplicate} onDelete={onDelete} />
          <AlignControls
            count={selectionCount}
            disabled={false}
            onAlign={onAlign}
            onDistribute={onDistribute}
          />
        </div>
      ) : null}

      {selection ? (
        <div className="flex flex-col gap-5">
          <Field label="Name">
            <Input
              value={selection.name}
              aria-label="Name"
              className="h-10 rounded-xl border-white/12 bg-white/[0.04] text-sm tracking-normal text-white normal-case"
              onChange={(event) => onPatch({ name: event.target.value })}
            />
          </Field>
          {selection.locked ? (
            <p className="text-xs text-white/45">Locked. Unlock it in the layers list to move it.</p>
          ) : null}

          {selection.type === "text" || Boolean(selection.text?.trim()) ? (
            <div className="flex flex-col gap-3.5">
              {selection.type === "image" || selection.fontId === ORIGINAL_WORD_FONT_ID ? (
                <p className="text-xs leading-relaxed text-white/45">
                  Original uses exact upload pixels. Pick any font to edit as live text — choose
                  Original again to restore the pixels.
                </p>
              ) : selection.hasOriginalWord ? (
                <p className="text-xs leading-relaxed text-white/45">
                  Choose Original to restore the exact upload pixels for this word.
                </p>
              ) : null}
              <Field label="Text">
                <textarea
                  value={selection.text ?? ""}
                  aria-label="Text"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus-visible:border-[#c4b5fd]/55 focus-visible:ring-3 focus-visible:ring-[#c4b5fd]/20"
                  onChange={(event) =>
                    onPatch({
                      text: event.target.value,
                      // Keep the Style color when promoting a word slice — font/text edits must not invent a new fill.
                      ...(selection.type === "image"
                        ? { fill: selection.fill ?? selection.sourceColor ?? undefined }
                        : {}),
                    })
                  }
                />
              </Field>
              <Field label="Font">
                <PanelSelect
                  ariaLabel="Font"
                  value={
                    selection.type === "image" && selection.text?.trim()
                      ? ORIGINAL_WORD_FONT_ID
                      : (selection.fontId ?? "outfit")
                  }
                  onChange={(value) =>
                    onPatch({
                      fontId: value,
                      ...(selection.type === "image"
                        ? { fill: selection.fill ?? selection.sourceColor ?? undefined }
                        : {}),
                    })
                  }
                  groups={fontGroupsForSelection(fonts, selection).map((group) => ({
                    category: group.category,
                    options: group.fonts.map((font) => ({ value: font.id, label: font.label })),
                  }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  resetKey={`${selection.id}:size`}
                  label="Size"
                  value={selection.fontSize ?? Math.max(12, selection.height)}
                  min={8}
                  max={500}
                  live
                  onCommit={(fontSize) =>
                    onPatch({
                      fontSize,
                      ...(selection.type === "image"
                        ? { fill: selection.fill ?? selection.sourceColor ?? undefined }
                        : {}),
                    })
                  }
                />
                <Field label="Weight">
                  <PanelSelect
                    ariaLabel="Weight"
                    value={String(selection.fontWeight ?? 500)}
                    onChange={(value) =>
                      onPatch({
                        fontWeight: Number(value),
                        ...(selection.type === "image"
                          ? { fill: selection.fill ?? selection.sourceColor ?? undefined }
                          : {}),
                      })
                    }
                    options={WEIGHTS}
                  />
                </Field>
              </div>
              {selection.onPath ? (
                <div className="flex flex-col gap-3">
                  <NumberField
                    resetKey={`${selection.id}:path`}
                    label="Path start"
                    value={selection.pathStartOffset ?? 0}
                    min={-2000}
                    max={2000}
                    disabled={selection.locked}
                    onCommit={(pathStartOffset) => onPatch({ pathStartOffset })}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 ${quiet}`}
                      disabled={selection.locked}
                      onClick={onFlipPath}
                    >
                      Flip path
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 ${quiet}`}
                      disabled={selection.locked}
                      onClick={onStraighten}
                    >
                      Straighten
                    </Button>
                  </div>
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

          {selection.type === "image" ? null : (
            <NumberField
              resetKey={`${selection.id}:stroke:${selection.strokeWidth}`}
              label="Stroke width"
              value={selection.strokeWidth}
              min={0}
              max={80}
              onCommit={(strokeWidth) => onPatch({ strokeWidth })}
            />
          )}

          {selection.type === "rect" ? (
            <NumberField
              resetKey={`${selection.id}:corner`}
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
              className="w-full accent-[#c4b5fd]"
              value={Math.round(selection.opacity * 100)}
              onChange={(event) => onPatch({ opacity: Number(event.target.value) / 100 })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              resetKey={`${selection.id}:x`}
              label="X"
              value={selection.x}
              disabled={selection.locked}
              onCommit={(x) => onPatch({ x })}
            />
            <NumberField
              resetKey={`${selection.id}:y`}
              label="Y"
              value={selection.y}
              disabled={selection.locked}
              onCommit={(y) => onPatch({ y })}
            />
            <NumberField
              resetKey={`${selection.id}:w`}
              label="W"
              value={selection.width}
              min={1}
              disabled={selection.locked}
              onCommit={(width) => onPatch({ width })}
            />
            <NumberField
              resetKey={`${selection.id}:h`}
              label="H"
              value={selection.height}
              min={1}
              disabled={selection.locked}
              onCommit={(height) => onPatch({ height })}
            />
          </div>

          <NumberField
            resetKey={`${selection.id}:angle`}
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
      <Button type="button" variant="outline" className={`flex-1 ${quiet}`} onClick={onDuplicate}>
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

function fontGroupsForSelection(fonts: EditorFontOption[], selection: SelectionSnapshot) {
  const groups = fontGroups(fonts);
  if (!(selection.type === "image" && selection.text?.trim()) && !selection.hasOriginalWord) {
    return groups;
  }
  return [
    {
      category: "Source",
      fonts: [
        {
          id: ORIGINAL_WORD_FONT_ID,
          label: "Original",
          category: "Source",
          canvasFamily: "Original",
        },
      ],
    },
    ...groups,
  ];
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
