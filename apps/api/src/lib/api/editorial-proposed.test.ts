import { expect, it } from "vitest";

import { proposedEditorialCatalog } from "./editorial-proposed";
import { openApiDocument } from "./openapi";

it("exports proposed schema documentation separately from production operations", () => {
  const catalog = proposedEditorialCatalog();
  expect(catalog.status).toBe("PROPOSED_NOT_IMPLEMENTED");
  expect(catalog.operations).toHaveLength(12);
  expect(catalog.schemas.EditorState).toHaveProperty("properties");
  expect(catalog.schemas.DraftPatch).toHaveProperty(
    "additionalProperties",
    false,
  );
  for (const root of catalog.roots) {
    expect(openApiDocument.paths).not.toHaveProperty(`${root}/{id}/draft`);
    expect(openApiDocument.paths).not.toHaveProperty(
      `${root}/{id}/publication`,
    );
    expect(openApiDocument.paths).not.toHaveProperty(`${root}/{id}/schedule`);
  }
});
