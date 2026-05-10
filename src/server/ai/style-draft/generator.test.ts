import { describe, expect, it } from "vitest";
import { generateFakeStyleBibleDraft } from "./generator";

describe("generateFakeStyleBibleDraft", () => {
  it("returns editable style fields without mutating state", () => {
    const result = generateFakeStyleBibleDraft({
      projectTitle: "Signal Tower Cut",
      sourceTexts: ["A tower glows during a storm."]
    });

    expect(result.draft.visualStyle).toContain("Signal Tower Cut");
    expect(result.draft.charactersText).toBeTruthy();
    expect(result.rationale.join(" ")).toContain("persisted");
  });

  it("preserves existing non-empty fields", () => {
    const result = generateFakeStyleBibleDraft({
      projectTitle: "Demo",
      sourceTexts: [],
      existingStyleBible: {
        visualStyle: "Existing visual style"
      }
    });

    expect(result.draft.visualStyle).toBe("Existing visual style");
    expect(result.warnings).toHaveLength(1);
  });
});
