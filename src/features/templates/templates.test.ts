import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateDocument, reassignObjectIds } from "../projects/document.ts";
import { starterTemplates } from "./catalog.ts";
import { starterTemplateDocuments } from "./documents.ts";
import { templateProjectName } from "./names.ts";
import { templatePreviewSvg } from "./preview.ts";

describe("starter templates", () => {
  it("publishes the locked set", () => {
    assert.deepEqual(
      starterTemplateDocuments.map((template) => template.slug),
      starterTemplates.map((template) => template.slug),
    );
    for (const template of starterTemplateDocuments) {
      const document = migrateDocument(template.document);
      const ids = document.objects.map((object) => object.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.match(templatePreviewSvg(document), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    }
  });

  it("gives a copied project a new object id and a copy name only when needed", () => {
    const source = starterTemplateDocuments[0]?.document;
    assert.ok(source);
    const copy = reassignObjectIds(source, () => "obj_copy");
    assert.equal(copy.objects[0]?.id, "obj_copy");
    assert.notEqual(copy.objects[0]?.id, source.objects[0]?.id);
    assert.equal(templateProjectName("Signal", []), "Signal");
    assert.equal(templateProjectName("Signal", ["Signal"]), "Signal copy");
    assert.equal(templateProjectName("  Northstar  ", ["Northstar"]), "Northstar copy");
  });
});
