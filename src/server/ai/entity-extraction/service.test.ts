import { describe, expect, it } from "vitest";

import { extractDraftEntities } from "./service";

describe("entity extraction service", () => {
  it("returns reviewable draft entities with duplicate detection and visual prompts", async () => {
    const draft = await extractDraftEntities({
      projectId: "project_1",
      sourceMaterialIds: ["source_1"],
      requestedAt: "2026-05-10T00:00:00.000Z",
      text: "NARRATOR: Aarav enters the Flooded Temple. Aarav lifts a lantern and studies the old map.",
      existingEntities: [{ id: "entity_aarav", name: "Aarav", type: "character" }]
    });

    expect(draft.provider).toBe("fake");
    expect(draft.draftEntities.length).toBeGreaterThan(0);
    expect(draft.draftEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Aarav",
          type: "character",
          duplicateOfEntityId: "entity_aarav",
          visualPromptBlock: expect.stringContaining("Aarav")
        }),
        expect.objectContaining({
          name: "Lantern",
          type: "object",
          duplicateOfEntityId: null,
          rationale: expect.stringContaining("object keyword")
        })
      ])
    );
  });
});
