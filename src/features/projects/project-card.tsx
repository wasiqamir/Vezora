"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectCard({
  project,
}: {
  project: { id: string; name: string; updatedAt: string; previewSvg?: string; width?: number; height?: number };
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<string | null>(null);
  const edited = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(project.updatedAt));

  async function rename() {
    const next = name.trim();
    if (!next || next === project.name) {
      setRenaming(false);
      setName(project.name);
      return;
    }
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    if (!response.ok) {
      setError("Could not rename that project.");
      return;
    }
    setRenaming(false);
    setError(null);
    router.refresh();
  }

  async function duplicate() {
    const response = await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
    if (!response.ok) {
      setError("Could not duplicate that project.");
      return;
    }
    setError(null);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete that project.");
      return;
    }
    router.refresh();
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e6e4ee] bg-white shadow-[0_10px_30px_rgba(22,20,31,0.04)]">
      <a href={`/editor/${project.id}`} className="block">
        {project.previewSvg ? (
          <div className="flex h-44 items-center justify-center bg-[#f4f2ec] px-6">
            <div
              className="h-full max-w-full [&_svg]:h-full [&_svg]:w-auto [&_svg]:max-w-full"
              role="img"
              aria-label={project.name}
              dangerouslySetInnerHTML={{ __html: project.previewSvg }}
            />
          </div>
        ) : (
          <div className="grid h-44 place-items-center bg-[#f4f2ec] px-6 text-sm text-[#16141f]/50">{project.name}</div>
        )}
      </a>
      <div className="flex flex-1 flex-col px-4 py-3.5">
        {renaming ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void rename();
            }}
          >
            <Input value={name} aria-label="Project name" onChange={(event) => setName(event.target.value)} />
            <Button type="submit" className="rounded-full">
              Save
            </Button>
          </form>
        ) : (
          <a href={`/editor/${project.id}`} className="font-medium text-[#16141f]">
            {project.name}
          </a>
        )}
        <p className="mt-1 text-xs text-[#16141f]/50" suppressHydrationWarning>
          Edited {edited}
        </p>
        {error ? <p className="mt-2 text-sm text-[#9f1239]">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void duplicate()}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}
