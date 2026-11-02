"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 truncate text-sm text-muted-foreground">{path}</p>
      <Button type="button" variant="outline" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
