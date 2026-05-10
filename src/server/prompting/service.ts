import { PromptPurpose, type Prisma } from "@prisma/client";

import { createPromptCompilation, type DbClient } from "@/server/db/repositories";

import { compilePrompt, type CompilePromptOptions } from "./compiler";
import type { CompiledPrompt, PromptCompilationInput } from "./types";

export interface CompilePanelPromptOptions {
  panelId: string;
  purpose?: PromptPurpose;
  provider?: string;
  model?: string;
  userNotes?: string | null;
}

export interface PersistPromptCompilationOptions {
  generationJobId?: string | null;
}

export async function compilePanelPrompt(
  db: DbClient,
  options: CompilePanelPromptOptions
): Promise<CompiledPrompt> {
  const input = await loadPanelPromptInput(db, options.panelId, options.userNotes);
  const modelDefaults = await resolveModelDefaults(db, input.project.id, options.purpose ?? PromptPurpose.IMAGE);

  return compilePrompt(input, {
    purpose: options.purpose ?? PromptPurpose.IMAGE,
    provider: options.provider ?? modelDefaults.provider,
    model: options.model ?? modelDefaults.model
  });
}

export async function storePromptCompilation(
  db: DbClient,
  compiled: CompiledPrompt,
  options: PersistPromptCompilationOptions = {}
) {
  return createPromptCompilation(db, {
    projectId: compiled.projectId,
    panelId: compiled.panelId,
    generationJobId: options.generationJobId,
    purpose: compiled.purpose,
    compiledPrompt: compiled.finalPrompt,
    layersSnapshot: compiled.snapshotPayload as unknown as Prisma.InputJsonValue,
    attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
    provider: compiled.provider,
    model: compiled.model,
    tokenEstimate: compiled.tokenEstimate
  });
}

export function preparePromptCompilationSnapshot(
  input: PromptCompilationInput,
  options: CompilePromptOptions
) {
  return compilePrompt(input, options).snapshotPayload;
}

async function loadPanelPromptInput(
  db: DbClient,
  panelId: string,
  userNotes?: string | null
): Promise<PromptCompilationInput> {
  const panel = await db.panel.findUnique({
    where: { id: panelId },
    include: {
      scene: true,
      project: {
        include: {
          sourceMaterials: true,
          styleBible: true,
          entities: true,
          scenes: {
            include: { panels: true }
          }
        }
      }
    }
  });

  if (!panel) {
    throw new Error(`Panel not found: ${panelId}`);
  }

  const mappedEntityIds = stringArray(panel.mappedEntityIds);
  const promptLayers = await db.promptLayer.findMany({
    where: {
      projectId: panel.projectId,
      OR: [
        { panelId: null, sceneId: null, entityId: null },
        { panelId: panel.id },
        { sceneId: panel.sceneId },
        ...(mappedEntityIds.length ? [{ entityId: { in: mappedEntityIds } }] : [])
      ]
    },
    orderBy: [{ sortOrder: "asc" }, { layerType: "asc" }, { title: "asc" }]
  });

  return {
    project: {
      id: panel.project.id,
      title: panel.project.title,
      description: panel.project.description,
      aspectRatio: panel.project.aspectRatio,
      targetDurationMinSeconds: panel.project.targetDurationMinSeconds,
      targetDurationMaxSeconds: panel.project.targetDurationMaxSeconds
    },
    sourceMaterials: panel.project.sourceMaterials.map((source) => ({
      id: source.id,
      type: source.type,
      title: source.title,
      bodyText: source.bodyText,
      url: source.url
    })),
    styleBible: panel.project.styleBible,
    entities: panel.project.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      visualPromptBlock: entity.visualPromptBlock,
      notes: entity.notes,
      selectedReferenceAssetId: entity.selectedReferenceAssetId
    })),
    scenes: panel.project.scenes.map((scene) => ({
      id: scene.id,
      orderIndex: scene.orderIndex,
      title: scene.title,
      summary: scene.summary,
      narrativePurpose: scene.narrativePurpose,
      notes: scene.notes,
      panels: scene.panels.map((scenePanel) => ({
        id: scenePanel.id,
        orderIndex: scenePanel.orderIndex,
        title: scenePanel.title,
        narrationText: scenePanel.narrationText,
        visualIntent: scenePanel.visualIntent
      }))
    })),
    scene: {
      id: panel.scene.id,
      orderIndex: panel.scene.orderIndex,
      title: panel.scene.title,
      summary: panel.scene.summary,
      narrativePurpose: panel.scene.narrativePurpose,
      notes: panel.scene.notes
    },
    panel: {
      id: panel.id,
      orderIndex: panel.orderIndex,
      title: panel.title,
      narrativePurpose: panel.narrativePurpose,
      narrationText: panel.narrationText,
      visualIntent: panel.visualIntent,
      motionIntent: panel.motionIntent,
      targetDurationSeconds: panel.targetDurationSeconds,
      notes: panel.notes,
      mappedEntityIds: panel.mappedEntityIds,
      panelReferenceAssetIds: panel.panelReferenceAssetIds,
      firstFrameAssetId: panel.firstFrameAssetId,
      lastFrameAssetId: panel.lastFrameAssetId
    },
    persistedLayers: promptLayers.map((layer) => ({
      id: layer.id,
      layerType: layer.layerType,
      title: layer.title,
      content: layer.content,
      isEditable: layer.isEditable,
      sortOrder: layer.sortOrder,
      panelId: layer.panelId,
      entityId: layer.entityId,
      sceneId: layer.sceneId,
      createdAt: layer.createdAt
    })),
    userNotes
  };
}

async function resolveModelDefaults(db: DbClient, projectId: string, purpose: PromptPurpose) {
  const modelStack = await db.modelStack.findUnique({ where: { projectId } });

  if (purpose === PromptPurpose.VIDEO) {
    return {
      provider: modelStack?.videoProvider ?? "xai",
      model: modelStack?.videoModel ?? "grok-imagine"
    };
  }

  if (purpose === PromptPurpose.AUDIO) {
    return {
      provider: modelStack?.voiceProvider ?? "google",
      model: modelStack?.voiceModel ?? "google-tts"
    };
  }

  if (purpose === PromptPurpose.TEXT || purpose === PromptPurpose.ENTITY_EXTRACTION || purpose === PromptPurpose.PANEL_SPLIT || purpose === PromptPurpose.ENTITY_MAPPING) {
    return {
      provider: modelStack?.textProvider ?? "openai",
      model: modelStack?.textModel ?? "gpt-4.1"
    };
  }

  return {
    provider: modelStack?.imageProvider ?? "openai",
    model: modelStack?.imageModel ?? "gpt-image-1"
  };
}

function stringArray(value: Prisma.JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
