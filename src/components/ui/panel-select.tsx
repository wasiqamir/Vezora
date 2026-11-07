"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";

export type PanelSelectOption = {
  value: string;
  label: string;
};

export type PanelSelectGroup = {
  category: string;
  options: PanelSelectOption[];
};

type PanelSelectProps = {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options?: PanelSelectOption[];
  groups?: PanelSelectGroup[];
  className?: string;
  /** Slightly shorter trigger for compact panels. */
  size?: "sm" | "md";
};

export function PanelSelect({
  ariaLabel,
  value,
  onChange,
  options,
  groups,
  className,
  size = "md",
}: PanelSelectProps) {
  const flat = groups?.flatMap((group) => group.options) ?? options ?? [];
  const items = Object.fromEntries(flat.map((option) => [option.value, option.label]));

  return (
    <Select.Root
      value={value}
      items={items}
      modal={false}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-left text-sm tracking-normal text-white normal-case outline-none transition",
          "hover:border-white/18 hover:bg-white/[0.07]",
          "focus-visible:border-[#c4b5fd]/55 focus-visible:ring-3 focus-visible:ring-[#c4b5fd]/20",
          "data-[popup-open]:border-[#c4b5fd]/40 data-[popup-open]:bg-white/[0.08]",
          size === "sm" ? "h-7 rounded-lg px-2 text-xs" : "h-10 px-3",
          className,
        )}
      >
        <Select.Value className="min-w-0 flex-1 truncate" />
        <Select.Icon className="shrink-0 text-white/45 transition data-[popup-open]:rotate-180 data-[popup-open]:text-white/70">
          <ChevronDown className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          className="z-[120] outline-none"
          sideOffset={6}
          alignItemWithTrigger={false}
          // Width lives on the positioner so Floating UI collision sizing stays correct.
          style={{ width: "var(--anchor-width)", minWidth: "12rem" }}
        >
          <Select.Popup
            className={cn(
              "max-h-72 origin-[var(--transform-origin)] overflow-hidden rounded-xl",
              "border border-white/12 bg-[#171224] text-white shadow-[0_22px_60px_-18px_rgba(0,0,0,0.75)]",
              "outline-none",
            )}
          >
            <Select.List className="max-h-72 overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:rgba(255,255,255,0.22)_transparent] [scrollbar-width:thin]">
              {groups
                ? groups.map((group) => (
                    <Select.Group key={group.category} className="pb-1 last:pb-0">
                      <Select.GroupLabel className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-[0.2em] text-white/35 uppercase">
                        {group.category}
                      </Select.GroupLabel>
                      {group.options.map((option) => (
                        <PanelSelectItem key={option.value} value={option.value} label={option.label} />
                      ))}
                    </Select.Group>
                  ))
                : flat.map((option) => (
                    <PanelSelectItem key={option.value} value={option.value} label={option.label} />
                  ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function PanelSelectItem({ value, label }: { value: string; label: string }) {
  return (
    <Select.Item
      value={value}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/80 outline-none select-none",
        "data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white",
        "data-[selected]:bg-[#c4b5fd]/18 data-[selected]:text-white",
      )}
    >
      <Select.ItemText className="min-w-0 flex-1 truncate">{label}</Select.ItemText>
      <Select.ItemIndicator className="shrink-0 text-[#c4b5fd]">
        <Check className="size-3.5" strokeWidth={2.5} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
