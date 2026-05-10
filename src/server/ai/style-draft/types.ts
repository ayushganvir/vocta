export type StyleBibleDraftField =
  | "charactersText"
  | "placesText"
  | "objectsText"
  | "visualStyle"
  | "colorPalette"
  | "lightingStyle"
  | "cameraStyle";

export type StyleBibleDraft = Record<StyleBibleDraftField, string>;

export interface StyleBibleDraftInput {
  projectTitle: string;
  sourceTexts: string[];
  existingStyleBible?: Partial<Record<StyleBibleDraftField, string | null>> | null;
}

export interface StyleBibleDraftResult {
  draft: StyleBibleDraft;
  rationale: string[];
  warnings: string[];
}

