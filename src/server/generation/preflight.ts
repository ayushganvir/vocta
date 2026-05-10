import type { Prisma } from "@prisma/client";

import { normalizeAudioSettings, normalizeVideoSettings, type VideoSettings } from "@/features/generation/settings";
import type { DbClient } from "@/server/db/repositories";
import { getProviderCapabilityMatrix, type ProviderCapabilityMatrixItem } from "@/server/providers/capabilities";
import type { ProviderCapability, ProviderKind } from "@/server/providers/types";

export type GenerationPreflightAssetType = "image" | "video" | "audio";
export type GenerationPreflightWarningSeverity = "info" | "warning";

export type GenerationPreflightWarningCode =
  | "MAPPED_ENTITY_MISSING_REFERENCE"
  | "MAPPED_ENTITY_NOT_FOUND"
  | "VIDEO_MISSING_SELECTED_IMAGE"
  | "VIDEO_MISSING_FIRST_LAST_FRAME"
  | "AUDIO_MISSING_NARRATION"
  | "AUDIO_MISSING_VOICE_ID"
  | "PROVIDER_CAPABILITY_UNVERIFIED"
  | "PROVIDER_CAPABILITY_UNSUPPORTED";

export interface GenerationPreflightWarning {
  code: GenerationPreflightWarningCode;
  severity: GenerationPreflightWarningSeverity;
  message: string;
  targetId?: string;
}

export interface GenerationPreflightInput {
  panelId: string;
  assetType: GenerationPreflightAssetType;
  sourceMode?: VideoSettings["sourceMode"];
}

export interface GenerationPreflightResult {
  ok: true;
  warnings: GenerationPreflightWarning[];
  canProceed: true;
}

export class GenerationPreflightPanelNotFoundError extends Error {
  constructor(panelId: string) {
    super(`Panel not found: ${panelId}`);
    this.name = "GenerationPreflightPanelNotFoundError";
  }
}

type LoadedPanel = NonNullable<Awaited<ReturnType<typeof loadPreflightPanel>>>;

export async function runGenerationPreflight(
  db: DbClient,
  input: GenerationPreflightInput
): Promise<GenerationPreflightResult> {
  const panel = await loadPreflightPanel(db, input.panelId);

  if (!panel) {
    throw new GenerationPreflightPanelNotFoundError(input.panelId);
  }

  const warnings: GenerationPreflightWarning[] = [];
  const mappedEntityIds = stringArray(panel.mappedEntityIds);
  const entityById = new Map(panel.project.entities.map((entity) => [entity.id, entity]));

  for (const entityId of mappedEntityIds) {
    const entity = entityById.get(entityId);

    if (!entity) {
      warnings.push({
        code: "MAPPED_ENTITY_NOT_FOUND",
        severity: "warning",
        message: "Mapped entity no longer exists.",
        targetId: entityId
      });
      continue;
    }

    if (
      (input.assetType === "image" || input.assetType === "video") &&
      isVisualEntity(entity) &&
      !entity.selectedReferenceAssetId
    ) {
      warnings.push({
        code: "MAPPED_ENTITY_MISSING_REFERENCE",
        severity: "warning",
        message: `Mapped visual entity "${entity.name}" has no selected reference asset.`,
        targetId: entity.id
      });
    }
  }

  if (input.assetType === "video") {
    addVideoWarnings(warnings, panel, input.sourceMode);
  }

  if (input.assetType === "audio") {
    addAudioWarnings(warnings, panel);
  }

  addProviderWarnings(warnings, panel, input.assetType, input.sourceMode);

  return {
    ok: true,
    warnings,
    canProceed: true
  };
}

async function loadPreflightPanel(db: DbClient, panelId: string) {
  return db.panel.findUnique({
    where: { id: panelId },
    select: {
      id: true,
      projectId: true,
      narrationText: true,
      mappedEntityIds: true,
      panelReferenceAssetIds: true,
      selectedImageAssetId: true,
      firstFrameAssetId: true,
      lastFrameAssetId: true,
      timelineMetadata: true,
      project: {
        select: {
          modelStack: {
            select: {
              imageProvider: true,
              imageModel: true,
              videoProvider: true,
              videoModel: true,
              voiceProvider: true,
              voiceModel: true,
              defaultVoiceId: true
            }
          },
          entities: {
            select: {
              id: true,
              name: true,
              type: true,
              selectedReferenceAssetId: true,
              metadata: true
            }
          }
        }
      }
    }
  });
}

function addVideoWarnings(
  warnings: GenerationPreflightWarning[],
  panel: LoadedPanel,
  requestedSourceMode?: VideoSettings["sourceMode"]
) {
  const videoSettings = normalizeVideoSettings(metadataField(panel.timelineMetadata, "videoSettings"));
  const sourceMode = requestedSourceMode ?? videoSettings.sourceMode;

  if (sourceMode === "image_to_video" && !panel.selectedImageAssetId) {
    warnings.push({
      code: "VIDEO_MISSING_SELECTED_IMAGE",
      severity: "warning",
      message: "Image-to-video generation has no selected image asset.",
      targetId: panel.id
    });
  }

  if (sourceMode === "first_last_frame" && (!panel.firstFrameAssetId || !panel.lastFrameAssetId)) {
    const missing = [
      panel.firstFrameAssetId ? null : "first frame",
      panel.lastFrameAssetId ? null : "last frame"
    ].filter((value): value is string => Boolean(value));

    warnings.push({
      code: "VIDEO_MISSING_FIRST_LAST_FRAME",
      severity: "warning",
      message: `First/last-frame generation is missing ${missing.join(" and ")} asset${missing.length === 1 ? "" : "s"}.`,
      targetId: panel.id
    });
  }
}

function addAudioWarnings(warnings: GenerationPreflightWarning[], panel: LoadedPanel) {
  const audioSettings = normalizeAudioSettings(metadataField(panel.timelineMetadata, "audioSettings"));
  const speakerEntity = audioSettings.speakerEntityId
    ? panel.project.entities.find((entity) => entity.id === audioSettings.speakerEntityId)
    : null;
  const speakerMetadata = metadataObject(speakerEntity?.metadata);
  const resolvedVoiceId =
    audioSettings.voiceId ??
    stringMetadata(speakerMetadata.voiceId) ??
    panel.project.modelStack?.defaultVoiceId ??
    null;

  if (!panel.narrationText?.trim()) {
    warnings.push({
      code: "AUDIO_MISSING_NARRATION",
      severity: "warning",
      message: "Audio generation has no panel narration.",
      targetId: panel.id
    });
  }

  if (!resolvedVoiceId?.trim()) {
    warnings.push({
      code: "AUDIO_MISSING_VOICE_ID",
      severity: "warning",
      message: "Audio generation has no resolved voice ID from panel audio settings, speaker metadata, or project default voice.",
      targetId: panel.id
    });
  }
}

function addProviderWarnings(
  warnings: GenerationPreflightWarning[],
  panel: LoadedPanel,
  assetType: GenerationPreflightAssetType,
  requestedSourceMode?: VideoSettings["sourceMode"]
) {
  const provider = providerSelection(panel, assetType);
  const capability = getProviderCapabilityMatrix().find(
    (item) => item.provider === provider.provider && item.kind === provider.kind
  );

  if (!capability) {
    warnings.push({
      code: "PROVIDER_CAPABILITY_UNVERIFIED",
      severity: "warning",
      message: `Provider "${provider.provider}" is not listed in the capability matrix for ${assetType} generation.`,
      targetId: provider.provider
    });
    return;
  }

  if (!capability.realAdapter) {
    warnings.push({
      code: "PROVIDER_CAPABILITY_UNVERIFIED",
      severity: "info",
      message: `Provider "${provider.provider}" is development-only; real provider behavior is not verified.`,
      targetId: provider.provider
    });
  }

  if (assetType === "image") {
    const selectedEntityReferenceIds = panel.project.entities
      .filter((entity) => stringArray(panel.mappedEntityIds).includes(entity.id))
      .map((entity) => entity.selectedReferenceAssetId)
      .filter((id): id is string => Boolean(id));
    const hasReferenceInputs = selectedEntityReferenceIds.length > 0 || stringArray(panel.panelReferenceAssetIds).length > 0;

    if (hasReferenceInputs && !hasCapability(capability, "image-references")) {
      warnings.push(providerUnsupportedWarning(
        capability,
        "Selected image provider does not advertise reference-image support in the current capability matrix."
      ));
    }

    const referenceNote = hasReferenceInputs ? providerNote(capability, /not wired|reference/i) : null;
    if (referenceNote) {
      warnings.push(providerUnverifiedWarning(provider.provider, assetType, referenceNote));
    }
  }

  if (assetType === "video") {
    const videoSettings = normalizeVideoSettings(metadataField(panel.timelineMetadata, "videoSettings"));
    const sourceMode = requestedSourceMode ?? videoSettings.sourceMode;

    if (sourceMode === "image_to_video" && !hasCapability(capability, "video-image-to-video")) {
      warnings.push(providerUnsupportedWarning(
        capability,
        "Selected video provider does not advertise image-to-video support in the current capability matrix."
      ));
    }

    if (sourceMode === "first_last_frame" && !hasCapability(capability, "video-first-last-frame")) {
      warnings.push(providerUnsupportedWarning(
        capability,
        "Selected video provider does not advertise first/last-frame support in the current capability matrix."
      ));
    }

    const verificationNote = providerNote(capability, /verification|unverified/i);
    if (verificationNote) {
      warnings.push(providerUnverifiedWarning(provider.provider, assetType, verificationNote));
    }
  }

  if (assetType === "audio") {
    const audioSettings = normalizeAudioSettings(metadataField(panel.timelineMetadata, "audioSettings"));
    const speakerEntity = audioSettings.speakerEntityId
      ? panel.project.entities.find((entity) => entity.id === audioSettings.speakerEntityId)
      : null;
    const speakerEmotion = stringMetadata(metadataObject(speakerEntity?.metadata).defaultEmotion);
    const hasEmotionControl = Boolean(audioSettings.emotion ?? speakerEmotion);
    const emotionNote = hasEmotionControl ? providerNote(capability, /metadata\/prompt guidance|emotion/i) : null;

    if (emotionNote) {
      warnings.push(providerUnverifiedWarning(provider.provider, assetType, emotionNote));
    }
  }
}

function providerSelection(panel: LoadedPanel, assetType: GenerationPreflightAssetType): {
  provider: string;
  model: string;
  kind: ProviderKind;
} {
  const modelStack = panel.project.modelStack;

  if (assetType === "video") {
    return {
      provider: modelStack?.videoProvider ?? "xai",
      model: modelStack?.videoModel ?? "grok-imagine-video",
      kind: "video"
    };
  }

  if (assetType === "audio") {
    return {
      provider: modelStack?.voiceProvider ?? "google",
      model: modelStack?.voiceModel ?? "google-tts",
      kind: "audio"
    };
  }

  return {
    provider: modelStack?.imageProvider ?? "openai",
    model: modelStack?.imageModel ?? "gpt-image-1",
    kind: "image"
  };
}

function providerUnsupportedWarning(
  capability: ProviderCapabilityMatrixItem,
  message: string
): GenerationPreflightWarning {
  return {
    code: "PROVIDER_CAPABILITY_UNSUPPORTED",
    severity: "warning",
    message,
    targetId: capability.provider
  };
}

function providerUnverifiedWarning(
  provider: string,
  assetType: GenerationPreflightAssetType,
  note: string
): GenerationPreflightWarning {
  return {
    code: "PROVIDER_CAPABILITY_UNVERIFIED",
    severity: "warning",
    message: `${provider} ${assetType} capability may need verification: ${note}`,
    targetId: provider
  };
}

function providerNote(capability: ProviderCapabilityMatrixItem, pattern: RegExp) {
  return capability.notes.find((note) => pattern.test(note));
}

function hasCapability(capability: ProviderCapabilityMatrixItem, providerCapability: ProviderCapability) {
  return capability.capabilities.includes(providerCapability);
}

function isVisualEntity(entity: { metadata: Prisma.JsonValue }) {
  return metadataObject(entity.metadata).speakerOnly !== true;
}

function metadataField(value: Prisma.JsonValue, key: string) {
  const object = metadataObject(value);
  return object[key];
}

function metadataObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: Prisma.JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
