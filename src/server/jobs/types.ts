export type JobType =
  | "story_analysis"
  | "style_bible_draft"
  | "entity_extraction"
  | "panel_split"
  | "entity_mapping"
  | "prompt"
  | "image"
  | "video"
  | "audio"
  | "export";

export type JobStatus = "queued" | "active" | "completed" | "failed" | "cancelled";

export interface JobReference {
  id: string;
  type: "source_material" | "entity" | "panel" | "asset" | "style_bible" | "scene";
  label?: string;
  urlOrPath?: string;
  metadata?: Record<string, unknown>;
}

export interface JobWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  targetId?: string;
}

export interface JobCostEstimate {
  currency: "USD";
  amount: number;
  billableUnits?: Record<string, number>;
}

export interface BaseJobPayload<TType extends JobType> {
  jobType: TType;
  projectId: string;
  generationJobId?: string;
  requestedByUserId?: string;
  requestedAt: string;
  manualRetryOfJobId?: string;
  debug?: boolean;
  metadata?: Record<string, unknown>;
}

export interface BaseJobResult<TType extends JobType> {
  jobType: TType;
  provider: string;
  model: string;
  completedAt: string;
  summary: string;
  warnings: JobWarning[];
  metadata?: Record<string, unknown>;
  costEstimate?: JobCostEstimate;
}

export interface StoryAnalysisJobPayload extends BaseJobPayload<"story_analysis"> {
  sourceMaterialIds: string[];
  scriptText: string;
  notes?: string;
  outputLanguage?: "en" | "hi";
}

export interface StoryAnalysisJobResult extends BaseJobResult<"story_analysis"> {
  storySummary: string;
  suggestedEntities: Array<{
    name: string;
    type: "character" | "place" | "object" | "speaker";
    description: string;
    visualPrompt?: string;
  }>;
  suggestedScenes: Array<{
    title: string;
    synopsis: string;
    orderIndex: number;
  }>;
  suggestedPanels: Array<{
    sceneOrderIndex: number;
    title: string;
    narration: string;
    visualIntent: string;
    motionIntent?: string;
  }>;
  styleSuggestions: Partial<StyleBibleDraft>;
}

export interface StyleBibleDraft {
  visualStyle: string;
  colorPalette: string[];
  lightingStyle: string;
  cameraStyle: string;
  negativePrompt?: string;
  brandNotes?: string;
}

export interface StyleBibleDraftJobPayload extends BaseJobPayload<"style_bible_draft"> {
  sourceMaterialIds: string[];
  storySummary?: string;
  existingStyleBible?: Partial<StyleBibleDraft>;
}

export interface StyleBibleDraftJobResult extends BaseJobResult<"style_bible_draft"> {
  draft: StyleBibleDraft;
  rationale: string[];
}

export interface EntityExtractionJobPayload extends BaseJobPayload<"entity_extraction"> {
  sourceMaterialIds: string[];
  text: string;
  existingEntities?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export interface EntityExtractionJobResult extends BaseJobResult<"entity_extraction"> {
  draftEntities: Array<{
    name: string;
    type: "character" | "place" | "object" | "speaker";
    description: string;
    visualPrompt?: string;
    duplicateOfEntityId?: string;
    rationale?: string;
  }>;
}

export interface PanelSplitJobPayload extends BaseJobPayload<"panel_split"> {
  sceneId?: string;
  sourceText: string;
  targetPanelCount?: number;
  preserveNarration?: boolean;
}

export interface PanelSplitJobResult extends BaseJobResult<"panel_split"> {
  draftPanels: Array<{
    title: string;
    narration: string;
    visualIntent: string;
    motionIntent?: string;
    orderIndex: number;
    estimatedDurationSeconds?: number;
  }>;
}

export interface EntityMappingJobPayload extends BaseJobPayload<"entity_mapping"> {
  panelIds: string[];
  entities: Array<{
    id: string;
    name: string;
    type: string;
    hasReferenceAsset: boolean;
    visualPrompt?: string;
  }>;
  panelSummaries: Array<{
    panelId: string;
    narration?: string;
    visualIntent?: string;
  }>;
}

export interface EntityMappingJobResult extends BaseJobResult<"entity_mapping"> {
  mappings: Array<{
    panelId: string;
    entityIds: string[];
    confidence: number;
    rationale?: string;
    missingReferenceWarnings: string[];
  }>;
}

export interface PromptJobPayload extends BaseJobPayload<"prompt"> {
  panelId: string;
  promptLayers: Array<{
    source: "global" | "source" | "story" | "style" | "entity" | "scene" | "panel" | "user";
    label: string;
    content: string;
    orderIndex: number;
  }>;
  outputKind: "image" | "video" | "audio" | "analysis";
}

export interface PromptJobResult extends BaseJobResult<"prompt"> {
  compiledPrompt: string;
  layerBreakdown: Array<{
    label: string;
    included: boolean;
    tokenEstimate: number;
  }>;
  negativePrompt?: string;
}

export interface ImageJobPayload extends BaseJobPayload<"image"> {
  panelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  frameRole?: "image" | "first_frame" | "last_frame";
  references?: JobReference[];
}

export interface GeneratedAssetContract {
  assetType: "image" | "video" | "audio" | "reference" | "export";
  fileName: string;
  mimeType: string;
  storagePath?: string;
  previewPath?: string;
  sizeBytes?: number;
  metadata: Record<string, unknown>;
}

export interface ImageJobResult extends BaseJobResult<"image"> {
  assets: GeneratedAssetContract[];
}

export interface VideoJobPayload extends BaseJobPayload<"video"> {
  panelId: string;
  prompt: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  sourceImageAssetIds?: string[];
  durationSeconds?: number;
  references?: JobReference[];
}

export interface VideoJobResult extends BaseJobResult<"video"> {
  assets: GeneratedAssetContract[];
  durationSeconds: number;
}

export interface AudioJobPayload extends BaseJobPayload<"audio"> {
  panelId: string;
  narration: string;
  voiceId?: string;
  pace?: "slow" | "normal" | "fast";
  emotion?: string;
  format: "wav" | "mp3";
}

export interface AudioJobResult extends BaseJobResult<"audio"> {
  assets: GeneratedAssetContract[];
  durationSeconds: number;
  transcript: string;
}

export interface ExportJobPayload extends BaseJobPayload<"export"> {
  exportPackageId: string;
  panelIds?: string[];
  format: "zip";
  includeJsonManifest: boolean;
  includeCsvManifest: boolean;
}

export interface ExportJobResult extends BaseJobResult<"export"> {
  packagePath: string;
  manifestPath: string;
  csvPath?: string;
  assetCount: number;
}

export interface JobPayloadByType {
  story_analysis: StoryAnalysisJobPayload;
  style_bible_draft: StyleBibleDraftJobPayload;
  entity_extraction: EntityExtractionJobPayload;
  panel_split: PanelSplitJobPayload;
  entity_mapping: EntityMappingJobPayload;
  prompt: PromptJobPayload;
  image: ImageJobPayload;
  video: VideoJobPayload;
  audio: AudioJobPayload;
  export: ExportJobPayload;
}

export interface JobResultByType {
  story_analysis: StoryAnalysisJobResult;
  style_bible_draft: StyleBibleDraftJobResult;
  entity_extraction: EntityExtractionJobResult;
  panel_split: PanelSplitJobResult;
  entity_mapping: EntityMappingJobResult;
  prompt: PromptJobResult;
  image: ImageJobResult;
  video: VideoJobResult;
  audio: AudioJobResult;
  export: ExportJobResult;
}

export type JobPayload<TType extends JobType = JobType> = JobPayloadByType[TType];
export type JobResult<TType extends JobType = JobType> = JobResultByType[TType];
