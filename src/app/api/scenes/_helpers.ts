import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db";

export const panelMetadataSchema = z.object({
  referenceNotes: z.string().optional().nullable(),
  imagePrompt: z.string().optional().nullable(),
  videoPrompt: z.string().optional().nullable(),
  audioPrompt: z.string().optional().nullable(),
  negativePrompt: z.string().optional().nullable()
});

export const panelPatchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  narrativePurpose: z.string().optional().nullable(),
  narrationText: z.string().optional().nullable(),
  visualIntent: z.string().optional().nullable(),
  motionIntent: z.string().optional().nullable(),
  targetDurationSeconds: z.number().int().positive().nullable().optional(),
  notes: z.string().optional().nullable(),
  mappedEntityIds: z.array(z.string()).optional(),
  panelReferenceAssetIds: z.array(z.string()).optional(),
  promptFields: panelMetadataSchema.optional()
});

export type PanelPatchInput = z.infer<typeof panelPatchSchema>;

export function badRequest(message: string, issues?: unknown) {
  return NextResponse.json({ error: message, issues }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serializePanel(panel: {
  id: string;
  projectId: string;
  sceneId: string;
  orderIndex: number;
  title: string;
  narrativePurpose: string | null;
  narrationText: string | null;
  visualIntent: string | null;
  motionIntent: string | null;
  targetDurationSeconds: number | null;
  notes: string | null;
  mappedEntityIds: Prisma.JsonValue;
  panelReferenceAssetIds: Prisma.JsonValue;
  firstFrameAssetId?: string | null;
  lastFrameAssetId?: string | null;
  selectedImageAssetId?: string | null;
  selectedVideoAssetId?: string | null;
  selectedAudioAssetId?: string | null;
  timelineMetadata: Prisma.JsonValue;
  staleState: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  generatedAssets?: Array<{
    id: string;
    assetType: string;
    fileUrl: string;
    previewUrl: string | null;
    storagePath: string;
    mimeType: string;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    isSelected: boolean;
    metadata: Prisma.JsonValue;
    generationJobId: string | null;
    createdAt: Date;
  }>;
  generationJobs?: Array<{
    id: string;
    type: string;
    provider: string;
    model: string;
    status: string;
    inputLayers: Prisma.JsonValue;
    attachedReferenceAssetIds: Prisma.JsonValue;
    compiledPrompt: string | null;
    requestPayload: Prisma.JsonValue;
    responsePayloadSummary: Prisma.JsonValue;
    outputAssetIds: Prisma.JsonValue;
    logs: Prisma.JsonValue;
    errorPayload: Prisma.JsonValue | null;
    durationMs: number | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
}) {
  const metadata = isJsonObject(panel.timelineMetadata) ? panel.timelineMetadata : {};

  return {
    id: panel.id,
    projectId: panel.projectId,
    sceneId: panel.sceneId,
    orderIndex: panel.orderIndex,
    title: panel.title,
    narrativePurpose: panel.narrativePurpose,
    narrationText: panel.narrationText,
    visualIntent: panel.visualIntent,
    motionIntent: panel.motionIntent,
    targetDurationSeconds: panel.targetDurationSeconds,
    notes: panel.notes,
    mappedEntityIds: jsonStringArray(panel.mappedEntityIds),
    panelReferenceAssetIds: jsonStringArray(panel.panelReferenceAssetIds),
    firstFrameAssetId: panel.firstFrameAssetId ?? null,
    lastFrameAssetId: panel.lastFrameAssetId ?? null,
    selectedImageAssetId: panel.selectedImageAssetId ?? null,
    selectedVideoAssetId: panel.selectedVideoAssetId ?? null,
    selectedAudioAssetId: panel.selectedAudioAssetId ?? null,
    promptFields: isJsonObject(metadata.promptFields) ? metadata.promptFields : {},
    staleState: panel.staleState,
    generatedAssets: panel.generatedAssets?.map(serializeGeneratedAsset) ?? [],
    generationJobs: panel.generationJobs?.map(serializeGenerationJob) ?? [],
    createdAt: panel.createdAt.toISOString(),
    updatedAt: panel.updatedAt.toISOString()
  };
}

function serializeGeneratedAsset(asset: NonNullable<Parameters<typeof serializePanel>[0]["generatedAssets"]>[number]) {
  return {
    id: asset.id,
    assetType: asset.assetType,
    fileUrl: asset.fileUrl,
    previewUrl: asset.previewUrl,
    storagePath: asset.storagePath,
    mimeType: asset.mimeType,
    durationSeconds: asset.durationSeconds,
    width: asset.width,
    height: asset.height,
    isSelected: asset.isSelected,
    metadata: asset.metadata,
    generationJobId: asset.generationJobId,
    createdAt: asset.createdAt.toISOString()
  };
}

function serializeGenerationJob(job: NonNullable<Parameters<typeof serializePanel>[0]["generationJobs"]>[number]) {
  return {
    id: job.id,
    type: job.type,
    provider: job.provider,
    model: job.model,
    status: job.status,
    inputLayers: job.inputLayers,
    attachedReferenceAssetIds: job.attachedReferenceAssetIds,
    compiledPrompt: job.compiledPrompt,
    requestPayload: job.requestPayload,
    responsePayloadSummary: job.responsePayloadSummary,
    outputAssetIds: job.outputAssetIds,
    logs: job.logs,
    errorPayload: job.errorPayload,
    durationMs: job.durationMs,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null
  };
}

export function serializeScene(scene: {
  id: string;
  projectId: string;
  orderIndex: number;
  title: string;
  summary: string | null;
  narrativePurpose: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  panels?: Parameters<typeof serializePanel>[0][];
}) {
  return {
    id: scene.id,
    projectId: scene.projectId,
    orderIndex: scene.orderIndex,
    title: scene.title,
    summary: scene.summary,
    narrativePurpose: scene.narrativePurpose,
    notes: scene.notes,
    panels: scene.panels?.map(serializePanel) ?? [],
    createdAt: scene.createdAt.toISOString(),
    updatedAt: scene.updatedAt.toISOString()
  };
}

export async function getDefaultProjectId(projectId?: string | null) {
  if (projectId) {
    return projectId;
  }

  const project = await prisma.project.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true }
  });

  return project?.id ?? null;
}

export async function reorderPanelsInTransaction(
  tx: Prisma.TransactionClient,
  sceneId: string,
  orderedPanelIds: string[]
) {
  const panels = await tx.panel.findMany({
    where: { sceneId },
    select: { id: true },
    orderBy: { orderIndex: "asc" }
  });
  const existingIds = panels.map((panel) => panel.id);
  const existingSet = new Set(existingIds);

  if (orderedPanelIds.length !== existingIds.length) {
    throw new Error("Panel reorder must include every panel in the scene.");
  }

  if (new Set(orderedPanelIds).size !== orderedPanelIds.length) {
    throw new Error("Panel reorder contains duplicate panel ids.");
  }

  for (const panelId of orderedPanelIds) {
    if (!existingSet.has(panelId)) {
      throw new Error("Panel reorder contains a panel outside this scene.");
    }
  }

  for (const [index, panelId] of orderedPanelIds.entries()) {
    await tx.panel.update({
      where: { id: panelId },
      data: { orderIndex: -(index + 1) }
    });
  }

  for (const [index, panelId] of orderedPanelIds.entries()) {
    await tx.panel.update({
      where: { id: panelId },
      data: { orderIndex: index + 1 }
    });
  }

  return tx.panel.findMany({
    where: { sceneId },
    orderBy: { orderIndex: "asc" },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
}

export async function compactScenePanelOrder(tx: Prisma.TransactionClient, sceneId: string) {
  const panels = await tx.panel.findMany({
    where: { sceneId },
    select: { id: true },
    orderBy: { orderIndex: "asc" }
  });

  return reorderPanelsInTransaction(
    tx,
    sceneId,
    panels.map((panel) => panel.id)
  );
}

export function panelUpdateData(input: PanelPatchInput): Prisma.PanelUncheckedUpdateInput {
  const data: Prisma.PanelUncheckedUpdateInput = {};

  if ("title" in input) {
    data.title = input.title;
  }

  if ("narrativePurpose" in input) {
    data.narrativePurpose = input.narrativePurpose ?? null;
  }

  if ("narrationText" in input) {
    data.narrationText = input.narrationText ?? null;
  }

  if ("visualIntent" in input) {
    data.visualIntent = input.visualIntent ?? null;
  }

  if ("motionIntent" in input) {
    data.motionIntent = input.motionIntent ?? null;
  }

  if ("targetDurationSeconds" in input) {
    data.targetDurationSeconds = input.targetDurationSeconds ?? null;
  }

  if ("notes" in input) {
    data.notes = input.notes ?? null;
  }

  if (input.mappedEntityIds) {
    data.mappedEntityIds = input.mappedEntityIds;
  }

  if (input.panelReferenceAssetIds) {
    data.panelReferenceAssetIds = input.panelReferenceAssetIds;
  }

  return data;
}

export function mergePromptFields(
  timelineMetadata: Prisma.JsonValue,
  promptFields: PanelPatchInput["promptFields"]
): Prisma.InputJsonValue {
  const metadata = isJsonObject(timelineMetadata) ? timelineMetadata : {};

  return {
    ...metadata,
    promptFields: promptFields ?? {}
  };
}

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonStringArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
