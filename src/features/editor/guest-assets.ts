/** Browser-only registry for guest uploads (no server asset yet). */

export type GuestAsset = {
  id: string;
  blob: Blob;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  name: string;
};

const assets = new Map<string, GuestAsset>();

export function isGuestAssetId(id: string) {
  return id.startsWith("guest_");
}

export function registerGuestAsset(input: {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  name?: string;
  /** Reuse a server-issued guest id so draft assetIds match the local blob. */
  id?: string;
}) {
  const id = input.id ?? `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const existing = assets.get(id);
  if (existing) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(input.blob);
  const asset: GuestAsset = {
    id,
    blob: input.blob,
    url,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    name: input.name ?? "upload",
  };
  assets.set(id, asset);
  return asset;
}

export function getGuestAsset(id: string) {
  return assets.get(id) ?? null;
}

export function getGuestAssetUrl(id: string) {
  return assets.get(id)?.url ?? null;
}

export function uploadSrc(assetId: string) {
  return getGuestAssetUrl(assetId) ?? `/api/uploads/${assetId}`;
}

export async function guestAssetsAsBase64(ids: Iterable<string>) {
  const out: Record<string, { mimeType: string; base64: string; width: number; height: number }> = {};
  for (const id of ids) {
    const asset = assets.get(id);
    if (!asset) continue;
    out[id] = {
      mimeType: asset.mimeType,
      base64: await blobToBase64(asset.blob),
      width: asset.width,
      height: asset.height,
    };
  }
  return out;
}

export function guestAssetIdsInDocument(document: {
  objects: { assetId?: string | null }[];
  reconstruction?: { sourceAssetId?: string | null } | null;
}) {
  const ids = new Set<string>();
  for (const object of document.objects) {
    if (object.assetId && isGuestAssetId(object.assetId)) ids.add(object.assetId);
  }
  const source = document.reconstruction?.sourceAssetId;
  if (source && isGuestAssetId(source)) ids.add(source);
  return [...ids];
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
      if (!value) reject(new Error("Could not read image."));
      else resolve(value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}
