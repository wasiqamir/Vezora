import { createHash } from "node:crypto";

const FOLDER = "Vezora";
const MAX_BYTES = 2_500_000;

export type LogoFile = {
  body: Buffer;
  mime: "image/png" | "image/svg+xml";
  filename: string;
};

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function decodeLogoImage(value: string): LogoFile | null {
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length < 16 || cleaned.length > 3_500_000) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null;
  const body = Buffer.from(cleaned, "base64");
  if (body.length < 8 || body.length > MAX_BYTES) return null;
  const png = body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47;
  if (png) return { body, mime: "image/png", filename: "logo.png" };
  const head = body.subarray(0, 200).toString("utf8").trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) {
    return { body, mime: "image/svg+xml", filename: "logo.svg" };
  }
  return null;
}

export async function uploadLogoFile(projectId: string, file: LogoFile) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${FOLDER}/logos/${projectId}`;
  const signed = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(signed + apiSecret).digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(file.body)], { type: file.mime }), file.filename);
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
