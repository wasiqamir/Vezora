import type { ProjectDocument } from "@/features/projects/document";
import type { ExportBackground, ExportFormat, ExportScale } from "@/features/editor/export-file";
import { guestAssetIdsInDocument, guestAssetsAsBase64 } from "@/features/editor/guest-assets";

export const GUEST_DRAFT_KEY = "vezora-guest-draft";

export type GuestDraftAsset = {
  mimeType: string;
  base64: string;
  width: number;
  height: number;
};

export type GuestDraft = {
  templateSlug: string;
  projectName: string;
  document: ProjectDocument;
  assets?: Record<string, GuestDraftAsset>;
  export: {
    format: ExportFormat;
    scale: ExportScale;
    background: ExportBackground;
  };
  openExport: boolean;
};

export async function buildGuestDraft(input: {
  templateSlug: string;
  projectName: string;
  document: ProjectDocument;
  export: GuestDraft["export"];
  openExport: boolean;
}): Promise<GuestDraft> {
  const ids = guestAssetIdsInDocument(input.document);
  const assets = ids.length > 0 ? await guestAssetsAsBase64(ids) : undefined;
  return {
    ...input,
    ...(assets && Object.keys(assets).length > 0 ? { assets } : {}),
  };
}

export function saveGuestDraft(draft: GuestDraft) {
  try {
    sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode may block storage; auth can still return to the try route.
  }
}

export function readGuestDraft(): GuestDraft | null {
  try {
    const raw = sessionStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestDraft;
  } catch {
    return null;
  }
}

export function clearGuestDraft() {
  try {
    sessionStorage.removeItem(GUEST_DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function guestAuthReturnPath(templateSlug: string) {
  if (templateSlug === "blank") {
    return "/editor/new?claim=1&export=1";
  }
  return `/editor/try/${encodeURIComponent(templateSlug)}?claim=1&export=1`;
}
