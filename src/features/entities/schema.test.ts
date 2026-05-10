import { describe, expect, it } from "vitest";

import { entityWriteSchema, getReferenceWarning, normalizeEntityMetadata } from "./schema";

describe("entity schema", () => {
  it("keeps entity type open for future custom records", () => {
    const parsed = entityWriteSchema.parse({
      projectId: "project-1",
      name: "Ancient Glyph",
      type: "Symbol",
      metadata: { speakerOnly: false }
    });

    expect(parsed.type).toBe("symbol");
  });

  it("allows speaker-only entities without reference warnings", () => {
    const metadata = normalizeEntityMetadata({
      speakerOnly: true,
      voiceLabel: "Warm narrator",
      voiceNotes: "Measured, calm delivery"
    });

    expect(
      getReferenceWarning({
        type: "character",
        selectedReferenceAssetId: null,
        metadata
      })
    ).toBeNull();
  });

  it("hard-warns visual entities that do not have a selected reference", () => {
    expect(
      getReferenceWarning({
        type: "object",
        selectedReferenceAssetId: null,
        metadata: normalizeEntityMetadata({ speakerOnly: false })
      })
    ).toContain("Hard warning");
  });
});
