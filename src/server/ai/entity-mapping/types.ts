export type EntityForMapping = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  visualPromptBlock?: string | null;
  selectedReferenceAssetId?: string | null;
  metadata?: {
    speakerOnly?: boolean;
  };
};

export type PanelForMapping = {
  id: string;
  title: string;
  narrationText?: string | null;
  visualIntent?: string | null;
  motionIntent?: string | null;
  notes?: string | null;
  mappedEntityIds?: string[];
};

export type EntityMappingSuggestion = {
  panelId: string;
  suggestedEntityIds: string[];
  confidence: number;
  rationale: string;
  missingReferenceWarnings: string[];
};

export type EntityMappingDraft = {
  projectId: string;
  provider: string;
  model: string;
  generatedAt: string;
  mappings: EntityMappingSuggestion[];
  warnings: string[];
};
