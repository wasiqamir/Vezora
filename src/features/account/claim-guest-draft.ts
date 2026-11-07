"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeUpload } from "@/features/assets/storage";
import { blankProjectDocument, migrateDocument, type ProjectDocument } from "@/features/projects/document";
import { createProject } from "@/features/projects/store";
import { resolvePublishedTemplate } from "@/features/templates/store";
import { getPrisma } from "@/lib/db";

export async function claimGuestDraftAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const templateSlug = String(formData.get("templateSlug") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim() || "Untitled logo";
  const openExport = String(formData.get("openExport") ?? "") === "1";
  const rawDocument = String(formData.get("document") ?? "");
  const rawAssets = String(formData.get("assets") ?? "");

  let document;
  if (rawDocument) {
    try {
      document = migrateDocument(JSON.parse(rawDocument));
    } catch {
      document = null;
    }
  }

  if (!document) {
    if (templateSlug === "blank") {
      document = blankProjectDocument();
    } else {
      const template = templateSlug ? await resolvePublishedTemplate(templateSlug) : null;
      if (!template) redirect("/templates?error=missing");
      document = template.document;
    }
  }

  let assets: Record<string, { mimeType: string; base64: string; width: number; height: number }> = {};
  if (rawAssets) {
    try {
      assets = JSON.parse(rawAssets) as typeof assets;
    } catch {
      assets = {};
    }
  }

  document = await materializeGuestAssets(session.user.id, document, assets);

  const source = templateSlug === "blank" ? "autosave" : "template";
  const project = await createProject(session.user.id, projectName, document, source);
  redirect(openExport ? `/editor/${project.id}?export=1` : `/editor/${project.id}`);
}

async function materializeGuestAssets(
  ownerId: string,
  document: ProjectDocument,
  assets: Record<string, { mimeType: string; base64: string; width: number; height: number }>,
) {
  const remap = new Map<string, string>();
  const prisma = getPrisma();

  for (const [guestId, payload] of Object.entries(assets)) {
    if (!guestId.startsWith("guest_")) continue;
    if (!payload?.base64 || !payload.mimeType) continue;
    const bytes = Uint8Array.from(Buffer.from(payload.base64, "base64"));
    const asset = await prisma.asset.create({
      data: {
        ownerId,
        kind: "upload",
        storageKey: "pending",
        mimeType: payload.mimeType,
        byteSize: bytes.byteLength,
        width: Math.max(1, Math.round(payload.width || 1)),
        height: Math.max(1, Math.round(payload.height || 1)),
        licenseName: "User upload",
        sourceName: "User",
      },
      select: { id: true },
    });
    const storageKey = await writeUpload(asset.id, bytes, payload.mimeType);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey },
    });
    remap.set(guestId, asset.id);
  }

  if (remap.size === 0) return document;

  return {
    ...document,
    objects: document.objects.map((object) =>
      object.assetId && remap.has(object.assetId)
        ? { ...object, assetId: remap.get(object.assetId)! }
        : object,
    ),
    reconstruction: document.reconstruction
      ? {
          ...document.reconstruction,
          sourceAssetId: remap.get(document.reconstruction.sourceAssetId) ?? document.reconstruction.sourceAssetId,
          jobId: document.reconstruction.jobId.startsWith("guest")
            ? `claim_${remap.values().next().value ?? "upload"}`.slice(0, 80)
            : document.reconstruction.jobId,
        }
      : document.reconstruction,
  };
}
