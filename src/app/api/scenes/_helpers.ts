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
  timelineMetadata: Prisma.JsonValue;
  staleState: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
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
    promptFields: isJsonObject(metadata.promptFields) ? metadata.promptFields : {},
    staleState: panel.staleState,
    createdAt: panel.createdAt.toISOString(),
    updatedAt: panel.updatedAt.toISOString()
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
    orderBy: { orderIndex: "asc" }
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
