import { createHash } from "node:crypto";

const FOLDER = "Vezora";
const MAX_BYTES = 2_500_000;

export type LogoFile = {
  body: Buffer;
  mime: "image/png" | "image/svg+xml";
  filename: string;
};

function cloudinaryEnv(name: "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET") {
  // Vercel/dashboard pastes sometimes keep trailing \\r\\n and break signed uploads.
  return process.env[name]?.replace(/^\s+|\s+$/g, "") || "";
}

export function cloudinaryConfigured() {
  return Boolean(
    cloudinaryEnv("CLOUDINARY_CLOUD_NAME") &&
      cloudinaryEnv("CLOUDINARY_API_KEY") &&
      cloudinaryEnv("CLOUDINARY_API_SECRET"),
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

/**
 * Upload a logo preview to Cloudinary. Uses a data-URI payload so Node serverless
 * FormData/Blob quirks cannot silently drop the file (which left imageUrl null).
 */
export async function uploadLogoFile(projectId: string, file: LogoFile) {
  const cloud = cloudinaryEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = cloudinaryEnv("CLOUDINARY_API_KEY");
  const apiSecret = cloudinaryEnv("CLOUDINARY_API_SECRET");
  if (!cloud || !apiKey || !apiSecret) {
    console.error("[logo-image] Cloudinary env vars are missing; preview imageUrl will not be stored.");
    return null;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  // Unique per upload so account cards refresh past CDN cache after each export.
  const publicId = `${FOLDER}/logos/${projectId}/${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const signed = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(signed + apiSecret).digest("hex");
  const dataUri = `data:${file.mime};base64,${file.body.toString("base64")}`;

  const attempt = async () => {
    const form = new FormData();
    form.set("file", dataUri);
    form.set("api_key", apiKey);
    form.set("timestamp", String(timestamp));
    form.set("signature", signature);
    form.set("public_id", publicId);
    form.set("overwrite", "true");
    form.set("invalidate", "true");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: form,
    });
    const payload = (await response.json().catch(() => null)) as {
      secure_url?: unknown;
      error?: { message?: unknown };
    } | null;
    if (!response.ok) {
      const message =
        typeof payload?.error?.message === "string" ? payload.error.message : `HTTP ${response.status}`;
      throw new Error(message);
    }
    if (typeof payload?.secure_url !== "string" || !payload.secure_url) {
      throw new Error("Cloudinary response missing secure_url.");
    }
    return payload.secure_url;
  };

  try {
    return await attempt();
  } catch (first) {
    try {
      return await attempt();
    } catch (second) {
      const detail = second instanceof Error ? second.message : String(second);
      const prior = first instanceof Error ? first.message : String(first);
      console.error(`[logo-image] Cloudinary upload failed for ${projectId}: ${detail} (retry after: ${prior})`);
      return null;
    }
  }
}
