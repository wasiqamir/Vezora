import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudinaryConfigured } from "@/features/assets/logo-image";

const root = path.join(process.cwd(), "storage", "uploads");
/** Inline data URLs stay in Neon — works on Vercel when Cloudinary/disk are unavailable. */
const INLINE_MAX_BYTES = 4 * 1024 * 1024;
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
  return (
    storageKey.startsWith("uploads/") ||
    storageKey.startsWith("https://") ||
    storageKey.startsWith("data:")
  );
}

/** Persist bytes. Prefer Cloudinary, then inline data URL, then local disk. */
export async function writeUpload(assetId: string, bytes: Uint8Array, mimeType = "image/png") {
  if (cloudinaryConfigured()) {
    const url = await writeUploadToCloudinary(assetId, bytes, mimeType);
    if (url) return url;
  }
  if (bytes.byteLength > 0 && bytes.byteLength <= INLINE_MAX_BYTES) {
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:${mimeType || "image/png"};base64,${b64}`;
  }
  try {
    await mkdir(root, { recursive: true });
    await writeFile(uploadPath(assetId), bytes);
    return uploadStorageKey(assetId);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not store upload (${error.message}).`
        : "Could not store upload.",
    );
  }
}

export async function readUpload(assetId: string, storageKey?: string | null) {
  if (storageKey?.startsWith("data:")) {
    const comma = storageKey.indexOf(",");
    if (comma < 0) throw new Error("Upload missing.");
    return Buffer.from(storageKey.slice(comma + 1), "base64");
  }
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
  const mime = mimeType || "image/png";
  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const form = new FormData();
  form.set("file", dataUri);
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
