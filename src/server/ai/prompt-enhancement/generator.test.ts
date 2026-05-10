import { describe, expect, it } from "vitest";
import { generateFakePromptEnhancement } from "./generator";

describe("generateFakePromptEnhancement", () => {
  it("creates separated image video and audio prompt suggestions", () => {
    const result = generateFakePromptEnhancement({
      panel: {
        title: "Temple reveal",
        narrationText: "The door opened under the moon.",
        visualIntent: "A flooded temple interior.",
        motionIntent: "Slow push-in."
      },
      styleBible: {
        visualStyle: "mythic realism",
        lightingStyle: "moonlit torchlight"
      },
      mappedEntityNames: ["Aarav", "Flooded Temple"]
    });

    expect(result.draft.imagePrompt).toContain("9:16");
    expect(result.draft.videoPrompt).toContain("Slow push-in");
    expect(result.draft.audioPrompt).toContain("The door opened");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when no mapped entities are available", () => {
    const result = generateFakePromptEnhancement({
      panel: { title: "Open" }
    });

    expect(result.warnings[0]).toContain("No mapped entities");
  });
});

