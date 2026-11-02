import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanvasType,
  assertImageEdges,
  assertUploadSize,
  readImageSize,
  UploadError,
} from "./inspect.ts";

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number) {
  const bytes = new Uint8Array(20);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 17);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
}

describe("upload inspection", () => {
  it("reads png, jpeg, and svg sizes", () => {
    assert.deepEqual(readImageSize(png(640, 480), "image/png"), { width: 640, height: 480 });
    assert.deepEqual(readImageSize(jpeg(800, 200), "image/jpeg"), { width: 800, height: 200 });
    assert.deepEqual(
      readImageSize(new TextEncoder().encode('<svg viewBox="0 0 320 180"></svg>'), "image/svg+xml"),
      { width: 320, height: 180 },
    );
  });

  it("rejects the wrong type, an oversized file, and an edge outside the canvas range", () => {
    assert.throws(() => assertCanvasType("image/gif"), (error: unknown) => {
      return error instanceof UploadError && error.status === 422 && error.code === "unsupported_type";
    });
    assert.throws(() => assertUploadSize(8 * 1024 * 1024 + 1), (error: unknown) => {
      return error instanceof UploadError && error.status === 413 && error.code === "upload_too_large";
    });
    assert.throws(() => assertImageEdges(32, 100), (error: unknown) => {
      return error instanceof UploadError && error.status === 422 && error.code === "validation_failed";
    });
    assert.throws(() => readImageSize(png(0, 0).slice(0, 8), "image/png"), UploadError);
  });
});
