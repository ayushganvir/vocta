export interface PromptEnhancementInput {
  panel: {
    title: string;
    narrationText?: string | null;
    visualIntent?: string | null;
    motionIntent?: string | null;
    notes?: string | null;
  };
  styleBible?: {
    visualStyle?: string | null;
    colorPalette?: string | null;
    lightingStyle?: string | null;
    cameraStyle?: string | null;
  } | null;
  mappedEntityNames?: string[];
}

export interface PromptEnhancementDraft {
  imagePrompt: string;
  videoPrompt: string;
  audioPrompt: string;
  referenceNotes: string;
  notes: string;
}

export interface PromptEnhancementResult {
  draft: PromptEnhancementDraft;
  rationale: string[];
  warnings: string[];
}

