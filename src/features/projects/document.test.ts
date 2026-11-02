import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blankProjectDocument,
  migrateDocument,
  ProjectDocumentError,
  projectFromScene,
  reassignObjectIds,
  sceneFromProject,
} from "./document.ts";
import type { SceneDocument } from "../editor/scene.ts";

const mark: SceneDocument = {
  artboard: { presetId: "square", width: 1000, height: 1000, background: "#ffffff" },
  objects: [
    {
      data: { id: "obj_bat", type: "path", name: "Bat" },
      visible: true,
      locked: false,
      left: 12.5,
      top: 40,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      opacity: 1,
      fill: "#C6A15B",
      stroke: null,
      strokeWidth: 0,
      path: "M 0 0 L 10 20 Z",
      fillRule: "nonzero",
    },
    {
      data: { id: "obj_name", type: "text", name: "RIDLEY", fontId: "cinzel" },
      visible: true,
      locked: true,
      left: 80,
      top: 700,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      opacity: 1,
      fill: "#12352C",
      stroke: null,
      strokeWidth: 0,
      text: "RIDLEY",
      fontFamily: "Cinzel",
      fontSize: 62,
      fontWeight: 600,
      letterSpacing: 120,
      lineHeight: 1.16,
      textAlign: "center",
    },
  ],
};

describe("project documents", () => {
  it("round-trips a path and styled text", () => {
    const saved = projectFromScene(mark);
    const opened = sceneFromProject(migrateDocument(saved));
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.artboard.preset, "square");
    assert.equal(saved.objects[0]?.type, "path");
    assert.equal(saved.objects[0]?.x, 12.5);
    assert.equal(opened.objects[1]?.text, "RIDLEY");
    assert.equal(opened.objects[1]?.letterSpacing, 120);
    assert.equal(opened.objects[1]?.locked, true);
    assert.equal(opened.objects[1]?.data.fontId, "cinzel");
    assert.equal(opened.objects[0]?.path, "M 0 0 L 10 20 Z");
  });

  it("rejects an unknown schema version", () => {
    assert.throws(
      () => migrateDocument({ ...blankProjectDocument(), schemaVersion: 2 }),
      (error: unknown) => error instanceof ProjectDocumentError && error.code === "unsupported_schema",
    );
  });

  it("gives duplicated objects new ids and keeps the drawing", () => {
    const saved = projectFromScene(mark);
    let n = 0;
    const copy = reassignObjectIds(saved, () => `obj_copy_${n++}`);
    assert.deepEqual(
      copy.objects.map((object) => object.id),
      ["obj_copy_0", "obj_copy_1"],
    );
    assert.equal(copy.objects[1]?.text, "RIDLEY");
    assert.notEqual(copy.objects[0]?.id, saved.objects[0]?.id);
  });
});
