import { describe, expect, it } from "vitest";

import { getMissingStyleBibleFields, styleBiblePatchSchema } from "./schema";

describe("style bible schema", () => {
  it("normalizes empty fields to null and reports warning-only gaps", () => {
    const parsed = styleBiblePatchSchema.parse({
      projectId: "project-1",
      charactersText: "Asha",
      placesText: " ",
      objectsText: "",
      visualStyle: "Grounded",
      colorPalette: "Teal",
      lightingStyle: "Practical",
      cameraStyle: "Handheld"
    });

    expect(parsed.placesText).toBeNull();
    expect(parsed.objectsText).toBeNull();
    expect(getMissingStyleBibleFields(parsed)).toEqual(["placesText", "objectsText"]);
  });
});
