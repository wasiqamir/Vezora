"use client";

import { cn } from "cn";

/** Native color inputs keep a light frame on some browsers; this paints our own swatch instead. */
export function ColorInput({
  value,
  disabled = false,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  "aria-label": string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-block size-8 shrink-0 overflow-hidden rounded-md",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: value }} />
      <input
        type="color"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
