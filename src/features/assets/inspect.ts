const MAX_BYTES = 8 * 1024 * 1024;
const MIN_EDGE = 64;
const MAX_EDGE = 4096;

export class UploadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const CANVAS_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export function assertUploadSize(byteSize: number) {
  if (byteSize > MAX_BYTES) {
    throw new UploadError(413, "upload_too_large", "Files must be 8 MB or smaller.");
  }
}

export function assertCanvasType(mimeType: string) {
  if (!CANVAS_TYPES.has(mimeType)) {
    throw new UploadError(422, "unsupported_type", "Use a PNG, JPG, or SVG image.");
  }
}

export function assertImageEdges(width: number, height: number) {
  if (width < MIN_EDGE || height < MIN_EDGE || width > MAX_EDGE || height > MAX_EDGE) {
    throw new UploadError(
      422,
      "validation_failed",
      "Images must be between 64 and 4096 pixels on each edge.",
    );
  }
}

export function readImageSize(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return pngSize(bytes);
  if (mimeType === "image/jpeg") return jpegSize(bytes);
  return svgSize(new TextDecoder().decode(bytes));
}

function pngSize(bytes: Uint8Array) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    throw new UploadError(422, "validation_failed", "That file is not a valid image.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new UploadError(422, "validation_failed", "That file is not a valid image.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    const length = view.getUint16(offset + 2);
    const isStart = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStart && offset + 9 < bytes.length) {
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  throw new UploadError(422, "validation_failed", "That file is not a valid image.");
}

function svgSize(source: string) {
  if (!/<svg[\s>]/i.test(source)) {
    throw new UploadError(422, "validation_failed", "That file is not a valid image.");
  }
  const viewBox = source.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const width = numberAttr(source, "width");
  const height = numberAttr(source, "height");
  const boxWidth = viewBox ? Number(viewBox[1]) : width;
  const boxHeight = viewBox ? Number(viewBox[2]) : height;
  if (!boxWidth || !boxHeight) {
    throw new UploadError(422, "validation_failed", "The SVG needs a width and height, or a viewBox.");
  }
  return { width: Math.round(boxWidth), height: Math.round(boxHeight) };
}

function numberAttr(source: string, name: string) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)`));
  return match ? Number(match[1]) : 0;
}
