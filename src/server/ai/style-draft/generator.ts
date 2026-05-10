import type { StyleBibleDraftInput, StyleBibleDraftResult } from "./types";

function summarizeSources(sourceTexts: string[]) {
  const combined = sourceTexts.join(" ").replace(/\s+/g, " ").trim();
  return combined.length > 0 ? combined.slice(0, 360) : "No source text has been added yet.";
}

export function generateFakeStyleBibleDraft(input: StyleBibleDraftInput): StyleBibleDraftResult {
  const sourceSummary = summarizeSources(input.sourceTexts);
  const existing = input.existingStyleBible ?? {};

  return {
    draft: {
      charactersText:
        existing.charactersText?.trim() ||
        "List recurring characters with one canonical visual description each. Include narrator/speaker entries separately when they have voice but no image reference.",
      placesText:
        existing.placesText?.trim() ||
        "Define the primary locations as reusable visual anchors with consistent geometry, atmosphere, and scale.",
      objectsText:
        existing.objectsText?.trim() ||
        "Track important props or symbolic objects that need consistent shape, material, and placement.",
      visualStyle:
        existing.visualStyle?.trim() ||
        `Cinematic 9:16 vertical realism for ${input.projectTitle}, grounded in the source premise: ${sourceSummary}`,
      colorPalette:
        existing.colorPalette?.trim() ||
        "Controlled contrast with deep environmental shadows, warm motivated highlights, and a small accent color per scene.",
      lightingStyle:
        existing.lightingStyle?.trim() ||
        "Motivated cinematic lighting: practical light sources, readable faces, strong silhouettes, and mobile-safe contrast.",
      cameraStyle:
        existing.cameraStyle?.trim() ||
        "Vertical-first framing with slow push-ins, clean establishing shots, close reaction beats, and minimal chaotic motion."
    },
    rationale: [
      "Draft keeps every field editable and optional.",
      "Draft favors reusable visual continuity over one-off prompt phrasing.",
      "No Style Bible field is persisted until the user applies and saves it."
    ],
    warnings:
      input.sourceTexts.length === 0
        ? ["No source material text was found, so the draft uses generic production-safe defaults."]
        : []
  };
}

