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
  const edited = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(project.updatedAt));

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

  const width = project.width && project.width > 0 ? project.width : 1;
  const height = project.height && project.height > 0 ? project.height : 1;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border">
      <a href={`/editor/${project.id}`} className="flex flex-col">
        {project.previewSvg ? (
          <div
            className="w-full bg-muted [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            style={{ aspectRatio: `${width} / ${height}` }}
            role="img"
            aria-label={project.name}
            dangerouslySetInnerHTML={{ __html: project.previewSvg }}
          />
        ) : (
          <div className="grid aspect-square place-items-center bg-muted text-sm text-muted-foreground">
            {project.name}
          </div>
        )}
        {renaming ? null : <h2 className="px-4 pt-4 font-medium">{project.name}</h2>}
      </a>
      {renaming ? (
        <form
          className="flex gap-2 px-4 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <Input value={name} aria-label="Project name" onChange={(event) => setName(event.target.value)} />
          <Button type="submit">Save</Button>
        </form>
      ) : null}
      <p className="px-4 pt-1 text-xs text-muted-foreground">Edited {edited}</p>
      {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-4">
        <Button type="button" variant="outline" onClick={() => setRenaming(true)}>
          Rename
        </Button>
        <Button type="button" variant="outline" onClick={() => void duplicate()}>
          Duplicate
        </Button>
        <Button type="button" variant="outline" onClick={() => void remove()}>
          Delete
        </Button>
      </div>
    </article>
  );
}
