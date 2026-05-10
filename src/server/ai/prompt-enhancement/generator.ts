import type { PromptEnhancementInput, PromptEnhancementResult } from "./types";

function compact(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function generateFakePromptEnhancement(input: PromptEnhancementInput): PromptEnhancementResult {
  const title = compact(input.panel.title) || "Untitled panel";
  const narration = compact(input.panel.narrationText);
  const visual = compact(input.panel.visualIntent);
  const motion = compact(input.panel.motionIntent);
  const style = compact(input.styleBible?.visualStyle) || "project visual style";
  const lighting = compact(input.styleBible?.lightingStyle) || "motivated cinematic lighting";
  const entities = input.mappedEntityNames?.length
    ? ` Maintain mapped entities: ${input.mappedEntityNames.join(", ")}.`
    : "";

  return {
    draft: {
      imagePrompt: `Create a 9:16 keyframe for "${title}". ${visual || narration || "Show the narrative beat clearly."} Use ${style}. Lighting: ${lighting}.${entities}`.trim(),
      videoPrompt: `Animate "${title}" as a short vertical clip. ${motion || "Use restrained, readable motion that supports the narration."} Preserve continuity with the selected keyframe and mapped entity references.${entities}`.trim(),
      audioPrompt: narration
        ? `Voiceover for "${title}": ${narration}`
        : `Voiceover for "${title}" should match the panel narration once written.`,
      referenceNotes: input.mappedEntityNames?.length
        ? `Use mapped entity references for ${input.mappedEntityNames.join(", ")}. Panel-specific references should override only this panel.`
        : "No mapped entity references are currently applied. Add entities before visual generation if consistency matters.",
      notes: compact(input.panel.notes) || "AI suggestion only. Review and edit before saving or generating."
    },
    rationale: [
      "Suggestions are field-level drafts and do not save automatically.",
      "Image, video, and audio prompts are separated so each provider call can stay inspectable.",
      "Mapped entities are included only as prompt context after the user has applied mapping."
    ],
    warnings: input.mappedEntityNames?.length ? [] : ["No mapped entities were found for this panel."]
  };
}

