export type DraftEntityType = "character" | "place" | "object" | "speaker" | string;

export type ExistingEntityForExtraction = {
  id: string;
  name: string;
  type: string;
};

export type DraftEntity = {
  draftId: string;
  name: string;
  type: DraftEntityType;
  description: string;
  visualPromptBlock: string | null;
  duplicateOfEntityId: string | null;
  duplicateReason: string | null;
  rationale: string;
  sourceTextSnippets: string[];
  metadata: {
    speakerOnly: boolean;
    confidence: number;
  };
};

export type EntityExtractionDraft = {
  projectId: string;
  provider: string;
  model: string;
  generatedAt: string;
  sourceMaterialIds: string[];
  draftEntities: DraftEntity[];
  warnings: string[];
};
