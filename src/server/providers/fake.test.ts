import { describe, expect, it } from "vitest";
import {
  createFakeImageProvider,
  createFakeProviderForJob,
  createFakeTextProvider,
  runProvider
} from "./fake";

describe("fake providers", () => {
  it("runs the full fake image provider lifecycle", async () => {
    const provider = createFakeImageProvider();
    const response = await runProvider(provider, {
      jobType: "image",
      projectId: "project_1",
      requestedAt: "2026-05-10T00:00:00.000Z",
      panelId: "panel_1",
      prompt: "Generate a vertical keyframe",
      aspectRatio: "9:16",
      references: [{ id: "entity_1", type: "entity", urlOrPath: "/ref.png" }]
    });

    expect(response.provider).toBe("fake");
    expect(response.jobType).toBe("image");
    if (response.jobType !== "image") {
      throw new Error("Expected image response");
    }
    expect(response.assets).toHaveLength(1);
    expect(response.assets[0]?.assetType).toBe("image");
    expect(response.assets[0]?.metadata.promptPreview).toContain("Generate a vertical");
    expect(response.costEstimate?.amount).toBe(0);
  });

  it("returns realistic text job draft fields", async () => {
    const provider = createFakeTextProvider();
    const response = await runProvider(provider, {
      jobType: "story_analysis",
      projectId: "project_1",
      requestedAt: "2026-05-10T00:00:00.000Z",
      sourceMaterialIds: ["source_1"],
      scriptText: "Aarav enters a flooded temple and finds a lantern."
    });

    expect(response.jobType).toBe("story_analysis");
    if (response.jobType !== "story_analysis") {
      throw new Error("Expected story analysis response");
    }
    expect(response.suggestedEntities.length).toBeGreaterThan(0);
    expect(response.suggestedPanels[0]?.visualIntent).toContain("vertical");
  });

  it("routes job types to matching fake provider kinds", () => {
    expect(createFakeProviderForJob("prompt").kind).toBe("text");
    expect(createFakeProviderForJob("image").kind).toBe("image");
    expect(createFakeProviderForJob("video").kind).toBe("video");
    expect(createFakeProviderForJob("audio").kind).toBe("audio");
  });

  it("rejects invalid provider input before execution", async () => {
    const provider = createFakeImageProvider();

    await expect(
      runProvider(provider, {
        jobType: "image",
        projectId: "",
        requestedAt: "2026-05-10T00:00:00.000Z",
        panelId: "panel_1",
        prompt: "",
        aspectRatio: "9:16"
      })
    ).rejects.toThrow("projectId is required");
  });
});
