import type { PromptLayerType, PromptPurpose } from "@prisma/client";

export type PromptLayerSource =
  | "project"
  | "source"
  | "story"
  | "style"
  | "entity"
  | "scene"
  | "panel"
  | "user"
  | "model"
  | "persisted";

export interface PromptLayerSnapshot {
  layerType: PromptLayerType;
  source: PromptLayerSource;
  title: string;
  content: string;
  sortOrder: number;
  editable: boolean;
  references: PromptLayerReference[];
  metadata?: Record<string, unknown>;
}

export interface PromptLayerReference {
  id: string;
  type: "project" | "source_material" | "style_bible" | "entity" | "scene" | "panel" | "asset";
  label?: string;
}

export interface CompiledPrompt {
  projectId: string;
  panelId?: string;
  purpose: PromptPurpose;
  provider: string;
  model: string;
  finalPrompt: string;
  layers: PromptLayerSnapshot[];
  layerBreakdown: PromptLayerBreakdownItem[];
  attachedReferenceAssetIds: string[];
  entityReferenceAssetIds: string[];
  panelReferenceAssetIds: string[];
  tokenEstimate: number;
  snapshotPayload: PromptCompilationSnapshotPayload;
}

export interface PromptLayerBreakdownItem {
  layerType: PromptLayerType;
  source: PromptLayerSource;
  title: string;
  included: boolean;
  orderIndex: number;
  tokenEstimate: number;
  references: PromptLayerReference[];
}

export interface PromptCompilationSnapshotPayload {
  schemaVersion: 1;
  purpose: PromptPurpose;
  provider: string;
  model: string;
  layers: PromptLayerSnapshot[];
  layerBreakdown: PromptLayerBreakdownItem[];
  references: {
    attachedReferenceAssetIds: string[];
    entityReferenceAssetIds: string[];
    panelReferenceAssetIds: string[];
  };
}

export interface SourceMaterialPromptInput {
  id: string;
  type: string;
  title: string;
  bodyText?: string | null;
  url?: string | null;
}

export interface StyleBiblePromptInput {
  id?: string;
  charactersText?: string | null;
  placesText?: string | null;
  objectsText?: string | null;
  visualStyle?: string | null;
  colorPalette?: string | null;
  lightingStyle?: string | null;
  cameraStyle?: string | null;
  negativePromptRules?: string | null;
  globalReferenceAssetIds?: unknown;
  notes?: string | null;
}

export interface EntityPromptInput {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  visualPromptBlock?: string | null;
  notes?: string | null;
  selectedReferenceAssetId?: string | null;
}

export interface ScenePromptInput {
  id: string;
  orderIndex: number;
  title: string;
  summary?: string | null;
  narrativePurpose?: string | null;
  notes?: string | null;
}

export interface PanelPromptInput {
  id: string;
  orderIndex: number;
  title: string;
  narrativePurpose?: string | null;
  narrationText?: string | null;
  visualIntent?: string | null;
  motionIntent?: string | null;
  targetDurationSeconds?: number | null;
  notes?: string | null;
  mappedEntityIds?: unknown;
  panelReferenceAssetIds?: unknown;
  firstFrameAssetId?: string | null;
  lastFrameAssetId?: string | null;
}

export interface StoryPanelPromptInput {
  id: string;
  orderIndex: number;
  title: string;
  narrationText?: string | null;
  visualIntent?: string | null;
}

export interface StoryScenePromptInput extends ScenePromptInput {
  panels?: StoryPanelPromptInput[];
}

export interface PersistedPromptLayerInput {
  id: string;
  layerType: PromptLayerType;
  title: string;
  content: string;
  isEditable: boolean;
  sortOrder: number;
  panelId?: string | null;
  entityId?: string | null;
  sceneId?: string | null;
  createdAt?: Date | string;
}

export interface PromptCompilationInput {
  project: {
    id: string;
    title: string;
    description?: string | null;
    aspectRatio?: string | null;
    targetDurationMinSeconds?: number | null;
    targetDurationMaxSeconds?: number | null;
  };
  sourceMaterials?: SourceMaterialPromptInput[];
  styleBible?: StyleBiblePromptInput | null;
  entities?: EntityPromptInput[];
  scenes?: StoryScenePromptInput[];
  scene?: ScenePromptInput | null;
  panel?: PanelPromptInput | null;
  persistedLayers?: PersistedPromptLayerInput[];
  userNotes?: string | null;
}
