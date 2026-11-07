"use client";

import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export function ShareLink({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-2.5",
        className,
      )}
    >
      <p className="min-w-0 flex-1 truncate font-mono text-sm text-white/70">{path}</p>
      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-full border-white/15 bg-white/[0.04] px-4 text-white/85 hover:bg-white/10 hover:text-white"
        onClick={() => void copy()}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
