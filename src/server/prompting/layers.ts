import { PromptLayerType } from "@prisma/client";

import type {
  EntityPromptInput,
  PanelPromptInput,
  PersistedPromptLayerInput,
  PromptCompilationInput,
  PromptLayerSnapshot,
  PromptLayerSource,
  ScenePromptInput,
  SourceMaterialPromptInput,
  StoryScenePromptInput,
  StyleBiblePromptInput
} from "./types";

const LAYER_SORT_ORDER: Record<PromptLayerType, number> = {
  GLOBAL_PROJECT_INTENT: 10,
  SOURCE_MATERIAL_SUMMARY: 20,
  STORY_CONTEXT: 30,
  STYLE_BIBLE: 40,
  ENTITY_REFERENCES: 50,
  SCENE_CONTEXT: 60,
  PANEL_CONTEXT: 70,
  USER_NOTES: 80,
  MODEL_SPECIFIC_FORMATTING: 90
};

export function buildPromptLayers(input: PromptCompilationInput): PromptLayerSnapshot[] {
  return stableLayerSort([
    createProjectLayer(input.project),
    createSourceMaterialLayer(input.sourceMaterials ?? []),
    createStoryLayer(input.scenes ?? []),
    createStyleBibleLayer(input.styleBible ?? null),
    createEntityReferenceLayer(input.entities ?? [], input.panel ?? null),
    createSceneLayer(input.scene ?? null),
    createPanelLayer(input.panel ?? null),
    createUserNotesLayer(input),
    ...createPersistedLayers(input.persistedLayers ?? [])
  ].filter(isPresent));
}

export function createProjectLayer(input: PromptCompilationInput["project"]): PromptLayerSnapshot {
  const lines = [
    `Project: ${input.title}`,
    input.description ? `Project description: ${input.description}` : null,
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : null,
    formatDurationRange(input.targetDurationMinSeconds, input.targetDurationMaxSeconds)
  ];

  return layer({
    layerType: "GLOBAL_PROJECT_INTENT",
    source: "project",
    title: "Project intent",
    content: joinLines(lines),
    editable: false,
    references: [{ id: input.id, type: "project", label: input.title }]
  });
}

export function createSourceMaterialLayer(
  sourceMaterials: SourceMaterialPromptInput[]
): PromptLayerSnapshot | null {
  const sorted = [...sourceMaterials].sort(compareByTypeTitleId);
  const content = sorted
    .map((source) => {
      const lines = [
        `${source.type}: ${source.title}`,
        source.bodyText ? `Content: ${source.bodyText}` : null,
        source.url ? `URL: ${source.url}` : null
      ];
      return joinLines(lines);
    })
    .filter(Boolean)
    .join("\n\n");

  if (!content) return null;

  return layer({
    layerType: "SOURCE_MATERIAL_SUMMARY",
    source: "source",
    title: "Source material",
    content,
    editable: false,
    references: sorted.map((source) => ({
      id: source.id,
      type: "source_material",
      label: source.title
    }))
  });
}

export function createStoryLayer(scenes: StoryScenePromptInput[]): PromptLayerSnapshot | null {
  const content = [...scenes]
    .sort(compareSceneOrder)
    .map((scene) => {
      const panelLines = [...(scene.panels ?? [])]
        .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
        .map((panel) => {
          const parts = [
            `Panel ${panel.orderIndex}: ${panel.title}`,
            panel.narrationText ? `narration=${panel.narrationText}` : null,
            panel.visualIntent ? `visual=${panel.visualIntent}` : null
          ].filter(isPresent);
          return `- ${parts.join("; ")}`;
        });

      return joinLines([
        `Scene ${scene.orderIndex}: ${scene.title}`,
        scene.summary ? `Summary: ${scene.summary}` : null,
        scene.narrativePurpose ? `Purpose: ${scene.narrativePurpose}` : null,
        panelLines.length ? panelLines.join("\n") : null
      ]);
    })
    .filter(Boolean)
    .join("\n\n");

  if (!content) return null;

  return layer({
    layerType: "STORY_CONTEXT",
    source: "story",
    title: "Story context",
    content,
    editable: false,
    references: [...scenes]
      .sort(compareSceneOrder)
      .map((scene) => ({ id: scene.id, type: "scene", label: scene.title }))
  });
}

export function createStyleBibleLayer(styleBible: StyleBiblePromptInput | null): PromptLayerSnapshot | null {
  if (!styleBible) return null;

  const lines = [
    field("Characters", styleBible.charactersText),
    field("Places", styleBible.placesText),
    field("Objects", styleBible.objectsText),
    field("Visual style", styleBible.visualStyle),
    field("Color palette", styleBible.colorPalette),
    field("Lighting", styleBible.lightingStyle),
    field("Camera", styleBible.cameraStyle),
    field("Negative prompt rules", styleBible.negativePromptRules),
    field("Style notes", styleBible.notes)
  ];
  const content = joinLines(lines);

  if (!content) return null;

  return layer({
    layerType: "STYLE_BIBLE",
    source: "style",
    title: "Style Bible",
    content,
    editable: false,
    references: [
      styleBible.id ? { id: styleBible.id, type: "style_bible" as const, label: "Style Bible" } : null,
      ...jsonStringArray(styleBible.globalReferenceAssetIds).map((id) => ({
        id,
        type: "asset" as const,
        label: "Global style reference"
      }))
    ].filter(isPresent)
  });
}

export function createEntityReferenceLayer(
  entities: EntityPromptInput[],
  panel: PanelPromptInput | null
): PromptLayerSnapshot | null {
  const mappedIds = jsonStringArray(panel?.mappedEntityIds);
  const mappedIdSet = new Set(mappedIds);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const mapped = mappedIds
    .map((id) => entityById.get(id))
    .filter(isPresent);

  const extras = entities
    .filter((entity) => mappedIdSet.has(entity.id) && !mapped.includes(entity))
    .sort(compareEntity);
  const selected = [...mapped, ...extras];

  if (!selected.length) return null;

  const content = selected
    .map((entity) =>
      joinLines([
        `${entity.type}: ${entity.name}`,
        entity.description ? `Description: ${entity.description}` : null,
        entity.visualPromptBlock ? `Visual prompt: ${entity.visualPromptBlock}` : null,
        entity.selectedReferenceAssetId
          ? `Reference asset ID: ${entity.selectedReferenceAssetId}`
          : null,
        entity.notes ? `Notes: ${entity.notes}` : null
      ])
    )
    .join("\n\n");

  return layer({
    layerType: "ENTITY_REFERENCES",
    source: "entity",
    title: "Mapped entity references",
    content,
    editable: false,
    references: selected.flatMap((entity) => [
      { id: entity.id, type: "entity" as const, label: entity.name },
      entity.selectedReferenceAssetId
        ? {
            id: entity.selectedReferenceAssetId,
            type: "asset" as const,
            label: `${entity.name} reference`
          }
        : null
    ].filter(isPresent))
  });
}

export function createSceneLayer(scene: ScenePromptInput | null): PromptLayerSnapshot | null {
  if (!scene) return null;

  const content = joinLines([
    `Scene ${scene.orderIndex}: ${scene.title}`,
    field("Summary", scene.summary),
    field("Narrative purpose", scene.narrativePurpose),
    field("Scene notes", scene.notes)
  ]);

  if (!content) return null;

  return layer({
    layerType: "SCENE_CONTEXT",
    source: "scene",
    title: "Scene context",
    content,
    editable: false,
    references: [{ id: scene.id, type: "scene", label: scene.title }]
  });
}

export function createPanelLayer(panel: PanelPromptInput | null): PromptLayerSnapshot | null {
  if (!panel) return null;

  const referenceIds = getPanelReferenceAssetIds(panel);
  const content = joinLines([
    `Panel ${panel.orderIndex}: ${panel.title}`,
    field("Narrative purpose", panel.narrativePurpose),
    field("Narration", panel.narrationText),
    field("Visual intent", panel.visualIntent),
    field("Motion intent", panel.motionIntent),
    panel.targetDurationSeconds ? `Target duration: ${panel.targetDurationSeconds}s` : null,
    referenceIds.length ? `Panel reference asset IDs: ${referenceIds.join(", ")}` : null
  ]);

  if (!content) return null;

  return layer({
    layerType: "PANEL_CONTEXT",
    source: "panel",
    title: "Panel context",
    content,
    editable: false,
    references: [
      { id: panel.id, type: "panel" as const, label: panel.title },
      ...referenceIds.map((id) => ({ id, type: "asset" as const, label: "Panel reference" }))
    ]
  });
}

export function createUserNotesLayer(input: PromptCompilationInput): PromptLayerSnapshot | null {
  const entityNotes = (input.entities ?? [])
    .filter((entity) => jsonStringArray(input.panel?.mappedEntityIds).includes(entity.id))
    .sort(compareEntity)
    .map((entity) => entity.notes ? `${entity.name}: ${entity.notes}` : null)
    .filter(isPresent);

  const notes = [
    field("Scene notes", input.scene?.notes),
    field("Panel notes", input.panel?.notes),
    ...entityNotes,
    field("User notes", input.userNotes)
  ];
  const content = joinLines(notes);

  if (!content) return null;

  return layer({
    layerType: "USER_NOTES",
    source: "user",
    title: "User notes",
    content,
    editable: true,
    references: []
  });
}

export function createModelFormattingLayer(provider: string, model: string): PromptLayerSnapshot {
  return layer({
    layerType: "MODEL_SPECIFIC_FORMATTING",
    source: "model",
    title: "Model formatting",
    content: joinLines([
      `Provider: ${provider}`,
      `Model: ${model}`,
      "Return only the prompt content needed for generation.",
      "Do not include alternate prompts or explanatory commentary."
    ]),
    editable: false,
    references: []
  });
}

export function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function getEntityReferenceAssetIds(entities: EntityPromptInput[], panel: PanelPromptInput | null) {
  const mappedIds = new Set(jsonStringArray(panel?.mappedEntityIds));
  return uniqueStable(
    entities
      .filter((entity) => mappedIds.has(entity.id))
      .sort(compareEntity)
      .map((entity) => entity.selectedReferenceAssetId)
      .filter(isPresent)
  );
}

export function getPanelReferenceAssetIds(panel: PanelPromptInput | null) {
  if (!panel) return [];

  return uniqueStable([
    ...jsonStringArray(panel.panelReferenceAssetIds),
    panel.firstFrameAssetId,
    panel.lastFrameAssetId
  ].filter(isPresent));
}

export function getStyleReferenceAssetIds(styleBible: StyleBiblePromptInput | null | undefined) {
  return uniqueStable(jsonStringArray(styleBible?.globalReferenceAssetIds));
}

export function uniqueStable(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function createPersistedLayers(layers: PersistedPromptLayerInput[]): PromptLayerSnapshot[] {
  return [...layers]
    .sort((a, b) =>
      a.sortOrder - b.sortOrder ||
      a.layerType.localeCompare(b.layerType) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
    )
    .map((persisted) => layer({
      layerType: persisted.layerType,
      source: "persisted",
      title: persisted.title,
      content: persisted.content,
      sortOrder: persisted.sortOrder,
      editable: persisted.isEditable,
      references: [
        persisted.panelId ? { id: persisted.panelId, type: "panel" as const } : null,
        persisted.sceneId ? { id: persisted.sceneId, type: "scene" as const } : null,
        persisted.entityId ? { id: persisted.entityId, type: "entity" as const } : null
      ].filter(isPresent),
      metadata: { promptLayerId: persisted.id }
    }));
}

function layer(input: Omit<PromptLayerSnapshot, "sortOrder"> & { sortOrder?: number }): PromptLayerSnapshot {
  return {
    sortOrder: input.sortOrder ?? LAYER_SORT_ORDER[input.layerType],
    ...input
  };
}

function stableLayerSort(layers: PromptLayerSnapshot[]) {
  return [...layers].sort((a, b) =>
    a.sortOrder - b.sortOrder ||
    a.layerType.localeCompare(b.layerType) ||
    a.title.localeCompare(b.title) ||
    a.source.localeCompare(b.source)
  );
}

function compareByTypeTitleId(a: SourceMaterialPromptInput, b: SourceMaterialPromptInput) {
  return a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function compareSceneOrder(a: ScenePromptInput, b: ScenePromptInput) {
  return a.orderIndex - b.orderIndex || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function compareEntity(a: EntityPromptInput, b: EntityPromptInput) {
  return a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function formatDurationRange(min?: number | null, max?: number | null) {
  if (min && max) return `Target duration: ${min}-${max}s`;
  if (min) return `Minimum target duration: ${min}s`;
  if (max) return `Maximum target duration: ${max}s`;
  return null;
}

function field(label: string, value?: string | null) {
  return value && value.trim() ? `${label}: ${value.trim()}` : null;
}

function joinLines(lines: Array<string | null | undefined>) {
  return lines.filter(isPresent).join("\n");
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined && value !== "";
}
