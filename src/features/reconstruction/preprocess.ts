import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

export type Raster = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export type ImageStudy = {
  colors: string[];
  hasTransparency: boolean;
  highContrast: boolean;
  approximate: boolean;
};

const SAMPLE_CAP = 40_000;

export function decodeRaster(bytes: Uint8Array, mimeType: string): Raster {
  if (mimeType === "image/png") {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, rgba: new Uint8Array(png.data) };
  }
  if (mimeType === "image/jpeg") {
    const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: jpeg.width, height: jpeg.height, rgba: new Uint8Array(jpeg.data) };
  }
  throw new Error("Use a PNG or JPG image.");
}

export function studyImage(raster: Raster): ImageStudy {
  const pixels = raster.width * raster.height;
  const step = Math.max(1, Math.floor(pixels / SAMPLE_CAP));
  const buckets = new Map<string, number>();
  let opaque = 0;
  let transparent = 0;
  let extreme = 0;
  for (let index = 0; index < pixels; index += step) {
    const offset = index * 4;
    const alpha = raster.rgba[offset + 3] ?? 0;
    if (alpha < 16) {
      transparent += 1;
      continue;
    }
    opaque += 1;
    const red = raster.rgba[offset] ?? 0;
    const green = raster.rgba[offset + 1] ?? 0;
    const blue = raster.rgba[offset + 2] ?? 0;
    const key = `${red >> 4},${green >> 4},${blue >> 4}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max < 48 || min > 224) extreme += 1;
  }
  const colors = [...buckets.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([key]) => bucketHex(key));
  return {
    colors,
    hasTransparency: transparent > opaque * 0.02,
    highContrast: opaque > 0 && extreme / opaque > 0.82 && colors.length <= 3,
    approximate: buckets.size > 28,
  };
}

export function fitRaster(raster: Raster, maxEdge: number) {
  const scale = Math.min(1, maxEdge / raster.width, maxEdge / raster.height);
  if (scale >= 0.999) return { raster, scale: 1 };
  const width = Math.max(1, Math.round(raster.width * scale));
  const height = Math.max(1, Math.round(raster.height * scale));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(raster.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(raster.width - 1, Math.floor(x / scale));
      const from = (sourceY * raster.width + sourceX) * 4;
      rgba.set(raster.rgba.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { raster: { width, height, rgba }, scale };
}

export function compositeOnWhite(raster: Raster): Raster {
  const rgba = new Uint8Array(raster.rgba.length);
  for (let index = 0; index < raster.width * raster.height; index += 1) {
    const offset = index * 4;
    const alpha = (raster.rgba[offset + 3] ?? 0) / 255;
    rgba[offset] = Math.round((raster.rgba[offset] ?? 255) * alpha + 255 * (1 - alpha));
    rgba[offset + 1] = Math.round((raster.rgba[offset + 1] ?? 255) * alpha + 255 * (1 - alpha));
    rgba[offset + 2] = Math.round((raster.rgba[offset + 2] ?? 255) * alpha + 255 * (1 - alpha));
    rgba[offset + 3] = 255;
  }
  return { width: raster.width, height: raster.height, rgba };
}

export function ocrPlates(raster: Raster): Raster[] {
  const count = raster.width * raster.height;
  const colored = new Uint8Array(count);
  const luminance = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const alpha = (raster.rgba[offset + 3] ?? 0) / 255;
    const red = (raster.rgba[offset] ?? 255) * alpha + 255 * (1 - alpha);
    const green = (raster.rgba[offset + 1] ?? 255) * alpha + 255 * (1 - alpha);
    const blue = (raster.rgba[offset + 2] ?? 255) * alpha + 255 * (1 - alpha);
    luminance[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const distance = Math.max(Math.abs(red - 255), Math.abs(green - 255), Math.abs(blue - 255));
    if (alpha > 0.08 && distance > 36) colored[index] = 1;
  }
  const outside = floodOutside(colored, raster.width, raster.height);
  const dark = blankPlate(raster.width, raster.height);
  const light = blankPlate(raster.width, raster.height);
  let lightPixels = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    if ((luminance[index] ?? 255) < 175) {
      dark[offset] = 0;
      dark[offset + 1] = 0;
      dark[offset + 2] = 0;
    }
    if (colored[index] === 0 && outside[index] === 0) {
      light[offset] = 0;
      light[offset + 1] = 0;
      light[offset + 2] = 0;
      lightPixels += 1;
    }
  }
  const plates = [{ width: raster.width, height: raster.height, rgba: dark }];
  if (lightPixels > 20) plates.push({ width: raster.width, height: raster.height, rgba: light });
  return plates;
}

function blankPlate(width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4);
  rgba.fill(255);
  return rgba;
}

function floodOutside(colored: Uint8Array, width: number, height: number) {
  const outside = new Uint8Array(colored.length);
  const queue = new Int32Array(colored.length);
  let head = 0;
  let tail = 0;
  const push = (index: number) => {
    if (outside[index] || colored[index]) return;
    outside[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (y > 0) push(index - width);
    if (y + 1 < height) push(index + width);
  }
  return outside;
}

export function encodePng(raster: Raster) {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.rgba);
  return new Uint8Array(PNG.sync.write(png));
}

function bucketHex(key: string) {
  const [red, green, blue] = key.split(",").map((value) => Number(value) * 17);
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

function byte(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}
