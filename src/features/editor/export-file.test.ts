import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSvgDocument,
  embedImageSource,
  exportFileName,
  objectsForExport,
  pngPixelSize,
  projectSlug,
} from "./export-file.ts";

describe("project slug", () => {
  it("lowercases the name and turns spaces into hyphens", () => {
    assert.equal(projectSlug("Untitled logo"), "untitled-logo");
  });

  it("removes characters outside letters, numbers, and hyphens", () => {
    assert.equal(projectSlug("Veyra! 1934"), "veyra-1934");
  });

  it("uses logo when the name has no filename characters", () => {
    assert.equal(projectSlug("***"), "logo");
  });
});

describe("export file name", () => {
  it("names an SVG from the project slug and ignores PNG scale", () => {
    assert.equal(exportFileName("Untitled logo", "svg", 2), "untitled-logo.svg");
  });

  it("names a 1× PNG and a 2× PNG", () => {
    assert.equal(exportFileName("Untitled logo", "png", 1), "untitled-logo.png");
    assert.equal(exportFileName("Untitled logo", "png", 2), "untitled-logo@2x.png");
  });
});

describe("png pixel size", () => {
  it("matches the artboard at 1× and doubles each edge at 2×", () => {
    assert.deepEqual(pngPixelSize(1000, 800, 1), { width: 1000, height: 800 });
    assert.deepEqual(pngPixelSize(512, 512, 2), { width: 1024, height: 1024 });
  });
});

describe("svg document", () => {
  it("uses the artboard for the viewport and keeps text as text", () => {
    const svg = buildSvgDocument({
      width: 1000,
      height: 800,
      background: "#ffffff",
      shapes: ['<text font-family="Outfit">VEYRA</text>', "<rect/>"],
    });
    assert.match(svg, /width="1000"/);
    assert.match(svg, /height="800"/);
    assert.match(svg, /viewBox="0 0 1000 800"/);
    assert.match(svg, /overflow="hidden"/);
    const backgroundAt = svg.indexOf('fill="#ffffff"');
    const textAt = svg.indexOf("<text");
    const shapeAt = svg.indexOf("<rect/>");
    assert.ok(backgroundAt > -1 && backgroundAt < textAt && textAt < shapeAt);
    assert.match(svg, /<text font-family="Outfit">VEYRA<\/text>/);
    assert.doesNotMatch(svg, /<path[^>]*>VEYRA/);
  });

  it("omits the background rectangle when the export is transparent", () => {
    const svg = buildSvgDocument({
      width: 256,
      height: 256,
      background: null,
      shapes: ["<text>Logo</text>"],
    });
    assert.equal(svg.includes('fill="'), false);
    assert.match(svg, /viewBox="0 0 256 256"/);
  });
});

describe("export contents", () => {
  it("drops hidden objects and keeps locked ones that are still visible", () => {
    const exported = objectsForExport([
      { id: "back", visible: true, locked: true },
      { id: "hidden", visible: false, locked: false },
      { id: "front", visible: true, locked: false },
    ]);
    assert.deepEqual(
      exported.map((object) => object.id),
      ["back", "front"],
    );
  });

  it("embeds an image source inside the SVG markup", () => {
    const markup = '<image href="https://cdn.example/mark.png"/>';
    const embedded = embedImageSource(markup, "https://cdn.example/mark.png", "data:image/png;base64,abc");
    assert.equal(embedded.includes("https://cdn.example/mark.png"), false);
    assert.match(embedded, /href="data:image\/png;base64,abc"/);
  });
});
