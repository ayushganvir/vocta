import { Prisma, type Panel } from "@prisma/client";

import type { DbClient } from "@/server/db/repositories";

export const staleMessages = {
  sourceMaterialChanged: "Source material changed after downstream panel work.",
  styleBibleChanged: "Style Bible changed after downstream panel work.",
  entityChanged: "Mapped entity changed after downstream panel work.",
  entityReferenceChanged: "Mapped entity reference changed after downstream panel work.",
  entityDeleted: "Mapped entity was deleted after downstream panel work.",
  panelNarrationChanged: "Panel narration changed after generated audio/video work.",
  panelVisualChanged: "Panel visual intent changed after generated image/video work.",
  panelMotionChanged: "Panel motion intent changed after generated video work.",
  panelPromptChanged: "Panel prompt fields changed after generated work.",
  panelReferencesChanged: "Panel references changed after generated image/video work.",
  panelEntityMappingChanged: "Panel entity mapping changed after generated image/video work.",
  panelOrderChanged: "Panel order changed; timeline manifest should be reviewed.",
  panelDuplicated: "Panel was duplicated and should be reviewed before generation/export."
} as const;

export type StaleReason = keyof typeof staleMessages;

export type MarkPanelsStaleInput = {
  projectId: string;
  panelIds?: string[];
  reason: StaleReason;
  message?: string;
};

export async function markPanelsStale(db: DbClient, input: MarkPanelsStaleInput) {
  const panels = await db.panel.findMany({
    where: {
      projectId: input.projectId,
      ...(input.panelIds?.length ? { id: { in: input.panelIds } } : {})
    },
    select: {
      id: true,
      staleState: true
    }
  });
  const message = input.message ?? staleMessages[input.reason];

  await Promise.all(
    panels.map((panel) =>
      db.panel.update({
        where: { id: panel.id },
        data: {
          staleState: {
            ...staleObject(panel.staleState),
            [input.reason]: message,
            updatedAt: new Date().toISOString()
          }
        }
      })
    )
  );

  return panels.length;
}

export async function markMappedEntityPanelsStale(
  db: DbClient,
  projectId: string,
  entityId: string,
  reason: Extract<StaleReason, "entityChanged" | "entityReferenceChanged" | "entityDeleted">,
  message?: string
) {
  const panels = await db.panel.findMany({
    where: { projectId },
    select: { id: true, mappedEntityIds: true }
  });
  const panelIds = panels
    .filter((panel) => jsonStringArray(panel.mappedEntityIds).includes(entityId))
    .map((panel) => panel.id);

  if (!panelIds.length) return 0;

  return markPanelsStale(db, {
    projectId,
    panelIds,
    reason,
    message
  });
}

export async function markPanelPatchStale(
  db: DbClient,
  current: Pick<
    Panel,
    | "id"
    | "projectId"
    | "narrationText"
    | "visualIntent"
    | "motionIntent"
    | "mappedEntityIds"
    | "panelReferenceAssetIds"
    | "timelineMetadata"
  >,
  patch: {
    narrationText?: string | null;
    visualIntent?: string | null;
    motionIntent?: string | null;
    mappedEntityIds?: string[];
    panelReferenceAssetIds?: string[];
    promptFields?: unknown;
    audioSettings?: unknown;
    videoSettings?: unknown;
  }
) {
  const reasons = new Set<StaleReason>();

  if ("narrationText" in patch && normalizeText(patch.narrationText) !== normalizeText(current.narrationText)) {
    reasons.add("panelNarrationChanged");
  }

  if ("visualIntent" in patch && normalizeText(patch.visualIntent) !== normalizeText(current.visualIntent)) {
    reasons.add("panelVisualChanged");
  }

  if ("motionIntent" in patch && normalizeText(patch.motionIntent) !== normalizeText(current.motionIntent)) {
    reasons.add("panelMotionChanged");
  }

  if (patch.promptFields && JSON.stringify(patch.promptFields) !== JSON.stringify(promptFields(current.timelineMetadata))) {
    reasons.add("panelPromptChanged");
  }

  if (patch.audioSettings && JSON.stringify(patch.audioSettings) !== JSON.stringify(metadataField(current.timelineMetadata, "audioSettings"))) {
    reasons.add("panelPromptChanged");
  }

  if (patch.videoSettings && JSON.stringify(patch.videoSettings) !== JSON.stringify(metadataField(current.timelineMetadata, "videoSettings"))) {
    reasons.add("panelPromptChanged");
  }

  if (patch.panelReferenceAssetIds && !sameStringArray(patch.panelReferenceAssetIds, jsonStringArray(current.panelReferenceAssetIds))) {
    reasons.add("panelReferencesChanged");
  }

  if (patch.mappedEntityIds && !sameStringArray(patch.mappedEntityIds, jsonStringArray(current.mappedEntityIds))) {
    reasons.add("panelEntityMappingChanged");
  }

  for (const reason of reasons) {
    await markPanelsStale(db, {
      projectId: current.projectId,
      panelIds: [current.id],
      reason
    });
  }

  return reasons.size;
}

export async function clearPanelStaleState(db: DbClient, panelId: string) {
  return db.panel.update({
    where: { id: panelId },
    data: { staleState: {} }
  });
}

export function staleWarnings(value: Prisma.JsonValue) {
  return Object.entries(staleObject(value))
    .filter(([key, flag]) => key !== "updatedAt" && Boolean(flag))
    .map(([key, flag]) => (typeof flag === "string" ? flag : key));
}

function staleObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Prisma.JsonObject).filter((entry): entry is [string, Prisma.JsonValue] => entry[1] !== undefined)
  );
}

function promptFields(value: Prisma.JsonValue) {
  return metadataField(value, "promptFields");
}

function metadataField(value: Prisma.JsonValue, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields = (value as Prisma.JsonObject)[field];
  return fields && typeof fields === "object" && !Array.isArray(fields) ? fields : {};
}

function jsonStringArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sameStringArray(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}
