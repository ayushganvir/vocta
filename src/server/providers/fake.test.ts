import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./fake";

describe("createFakeProvider", () => {
  it("returns deterministic fake image output", async () => {
    const provider = createFakeProvider("image");
    const response = await provider.execute({
      prompt: "Generate a vertical keyframe",
      references: [{ id: "entity_1", urlOrPath: "/ref.png", role: "entity" }]
    });

    expect(response.provider).toBe("fake");
    expect(response.assets).toHaveLength(1);
    expect(response.assets[0]?.assetType).toBe("image");
    expect(response.summary.referenceCount).toBe(1);
  });
});

