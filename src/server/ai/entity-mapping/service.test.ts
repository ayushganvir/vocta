import { describe, expect, it } from "vitest";

import { buildEntityMappingDraft, normalizeMappingApplyInput } from "./service";

describe("entity mapping service", () => {
  it("suggests panel mappings with confidence, rationale, and missing reference warnings", async () => {
    const draft = await buildEntityMappingDraft({
      projectId: "project_1",
      requestedAt: "2026-05-10T00:00:00.000Z",
      entities: [
        {
          id: "entity_aarav",
          name: "Aarav",
          type: "character",
          selectedReferenceAssetId: null,
          description: "Aarav is the hero."
        },
        {
          id: "entity_temple",
          name: "Flooded Temple",
          type: "place",
          selectedReferenceAssetId: "asset_temple"
        }
      ],
      panels: [
        {
          id: "panel_1",
          title: "Temple reveal",
          narrationText: "Aarav reaches the Flooded Temple.",
          visualIntent: "Aarav stands at the temple gate."
        }
      ]
    });

    expect(draft.provider).toBe("fake");
    expect(draft.mappings[0]).toEqual(
      expect.objectContaining({
        panelId: "panel_1",
        confidence: expect.any(Number),
        rationale: expect.stringContaining("Matched panel text")
      })
    );
    expect(draft.mappings[0]?.suggestedEntityIds).toEqual(
      expect.arrayContaining(["entity_aarav", "entity_temple"])
    );
    expect(draft.mappings[0]?.missingReferenceWarnings).toContain("Aarav has no selected reference asset.");
  });

  it("normalizes apply input without mutating anything itself", () => {
    expect(
      normalizeMappingApplyInput([
        { panelId: "panel_1", suggestedEntityIds: ["entity_1", "entity_1", "entity_2"] }
      ])
    ).toEqual([{ panelId: "panel_1", entityIds: ["entity_1", "entity_2"] }]);
  });
});
