import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "storage", "uploads");

function uploadPath(assetId: string) {
  const name = path.basename(assetId);
  if (!name || name !== assetId) throw new Error("Invalid upload id.");
  return path.join(root, name);
}

export function uploadStorageKey(assetId: string) {
  return path.posix.join("uploads", path.basename(assetId));
}

export async function writeUpload(assetId: string, bytes: Uint8Array) {
  await mkdir(root, { recursive: true });
  await writeFile(uploadPath(assetId), bytes);
}

export async function readUpload(assetId: string) {
  return readFile(uploadPath(assetId));
}
