import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudinaryConfigured } from "@/features/assets/logo-image";

const root = path.join(process.cwd(), "storage", "uploads");
const FOLDER = "Vezora";

function uploadPath(assetId: string) {
  const name = path.basename(assetId);
  if (!name || name !== assetId) throw new Error("Invalid upload id.");
  return path.join(root, name);
}

export function uploadStorageKey(assetId: string) {
  return path.posix.join("uploads", path.basename(assetId));
}

export function isUploadStorageKey(storageKey: string) {
  return storageKey.startsWith("uploads/") || storageKey.startsWith("https://");
}

/** Persist bytes. On Vercel use Cloudinary; locally fall back to disk. Returns the storage key to save. */
export async function writeUpload(assetId: string, bytes: Uint8Array, mimeType = "image/png") {
  if (cloudinaryConfigured()) {
    const url = await writeUploadToCloudinary(assetId, bytes, mimeType);
    if (url) return url;
  }
  await mkdir(root, { recursive: true });
  await writeFile(uploadPath(assetId), bytes);
  return uploadStorageKey(assetId);
}

export async function readUpload(assetId: string, storageKey?: string | null) {
  if (storageKey?.startsWith("https://")) {
    const response = await fetch(storageKey);
    if (!response.ok) throw new Error("Upload missing.");
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(uploadPath(assetId));
}

async function writeUploadToCloudinary(assetId: string, bytes: Uint8Array, mimeType: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${FOLDER}/uploads/${assetId}`;
  const signed = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(signed + apiSecret).digest("hex");
  const form = new FormData();
  const filename = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "upload.jpg" : "upload.png";
  form.set("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("public_id", publicId);
  form.set("overwrite", "true");
  form.set("invalidate", "true");
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { secure_url?: unknown };
    return typeof payload.secure_url === "string" ? payload.secure_url : null;
  } catch {
    return null;
  }
}
