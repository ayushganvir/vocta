import { AssetType, GenerationJobType, JobStatus, Prisma, PromptPurpose } from "@prisma/client";

import {
  createGeneratedAsset,
  createGenerationJob,
  selectPanelAsset,
  updateGenerationJobStatus,
  type DbClient
} from "@/server/db/repositories";
import type { AudioJobPayload, GeneratedAssetContract, ImageJobPayload, VideoJobPayload } from "@/server/jobs/types";
import { compilePanelPrompt, storePromptCompilation } from "@/server/prompting/service";
import { createFakeProviderForJob, runProvider } from "@/server/providers/fake";
import { LocalStorageDriver } from "@/server/storage/local";
import type { StorageDriver } from "@/server/storage/types";

type ImageFrameRole = NonNullable<ImageJobPayload["frameRole"]>;

export type GeneratePanelImageInput = {
  panelId: string;
  frameRole?: ImageFrameRole;
};

export type GeneratePanelVideoInput = {
  panelId: string;
  durationSeconds?: number | null;
};

export type GeneratePanelAudioInput = {
  panelId: string;
  voiceId?: string | null;
  pace?: AudioJobPayload["pace"];
  emotion?: string | null;
  format?: AudioJobPayload["format"];
};

type GenerationServiceOptions = {
  storage?: StorageDriver;
  now?: () => Date;
};

const DEFAULT_ASPECT_RATIO = "9:16";

export async function generatePanelImage(
  db: DbClient,
  input: GeneratePanelImageInput,
  options: GenerationServiceOptions = {}
) {
  const frameRole = input.frameRole ?? "image";
  const compiled = await compilePanelPrompt(db, {
    panelId: input.panelId,
    purpose: PromptPurpose.IMAGE,
    userNotes: frameRole === "image" ? "Generate the selected key image." : `Generate the ${frameRole.replace("_", " ")}.`
  });
  const job = await createGenerationJob(db, {
    projectId: compiled.projectId,
    panelId: input.panelId,
    type: GenerationJobType.IMAGE,
    provider: compiled.provider,
    model: compiled.model,
    compiledPrompt: compiled.finalPrompt,
    inputLayers: compiled.snapshotPayload.layers as unknown as Prisma.InputJsonValue,
    attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
    requestPayload: {
      frameRole,
      promptPurpose: compiled.purpose
    }
  });
  await storePromptCompilation(db, compiled, { generationJobId: job.id });

  const payload: ImageJobPayload = {
    jobType: "image",
    projectId: compiled.projectId,
    panelId: input.panelId,
    generationJobId: job.id,
    requestedAt: nowIso(options.now),
    prompt: compiled.finalPrompt,
    negativePrompt: extractNegativePrompt(compiled.finalPrompt),
    aspectRatio: DEFAULT_ASPECT_RATIO,
    frameRole,
    references: compiled.attachedReferenceAssetIds.map((id) => ({ id, type: "asset" }))
  };

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: async (assetId) => {
      if (frameRole === "first_frame") {
        await selectPanelFrameAsset(db, input.panelId, assetId, "firstFrameAssetId");
        return;
      }

      if (frameRole === "last_frame") {
        await selectPanelFrameAsset(db, input.panelId, assetId, "lastFrameAssetId");
        return;
      }

      await selectPanelPrimaryImageAsset(db, input.panelId, assetId);
    }
  });
}

export async function generatePanelVideo(
  db: DbClient,
  input: GeneratePanelVideoInput,
  options: GenerationServiceOptions = {}
) {
  const panel = await db.panel.findUniqueOrThrow({
    where: { id: input.panelId },
    select: {
      projectId: true,
      targetDurationSeconds: true,
      selectedImageAssetId: true,
      firstFrameAssetId: true,
      lastFrameAssetId: true
    }
  });
  const compiled = await compilePanelPrompt(db, {
    panelId: input.panelId,
    purpose: PromptPurpose.VIDEO,
    userNotes: "Generate a sync-friendly vertical clip. Preserve selected panel references."
  });
  const sourceImageAssetIds = [
    panel.selectedImageAssetId,
    panel.firstFrameAssetId,
    panel.lastFrameAssetId
  ].filter((id): id is string => Boolean(id));
  const durationSeconds = input.durationSeconds ?? panel.targetDurationSeconds ?? 6;
  const job = await createGenerationJob(db, {
    projectId: compiled.projectId,
    panelId: input.panelId,
    type: GenerationJobType.VIDEO,
    provider: compiled.provider,
    model: compiled.model,
    compiledPrompt: compiled.finalPrompt,
    inputLayers: compiled.snapshotPayload.layers as unknown as Prisma.InputJsonValue,
    attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
    requestPayload: {
      durationSeconds,
      sourceImageAssetIds,
      promptPurpose: compiled.purpose
    }
  });
  await storePromptCompilation(db, compiled, { generationJobId: job.id });

  const payload: VideoJobPayload = {
    jobType: "video",
    projectId: panel.projectId,
    panelId: input.panelId,
    generationJobId: job.id,
    requestedAt: nowIso(options.now),
    prompt: compiled.finalPrompt,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    durationSeconds,
    sourceImageAssetIds,
    references: compiled.attachedReferenceAssetIds.map((id) => ({ id, type: "asset" }))
  };

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: async (assetId) => {
      await selectPanelAsset(db, input.panelId, assetId, AssetType.VIDEO);
    }
  });
}

export async function generatePanelAudio(
  db: DbClient,
  input: GeneratePanelAudioInput,
  options: GenerationServiceOptions = {}
) {
  const panel = await db.panel.findUniqueOrThrow({
    where: { id: input.panelId },
    select: {
      projectId: true,
      narrationText: true,
      timelineMetadata: true,
      project: {
        select: {
          modelStack: {
            select: {
              defaultVoiceId: true
            }
          }
        }
      }
    }
  });
  const compiled = await compilePanelPrompt(db, {
    panelId: input.panelId,
    purpose: PromptPurpose.AUDIO,
    userNotes: buildAudioUserNotes(input)
  });
  const narration = panel.narrationText?.trim() || extractPromptField(panel.timelineMetadata, "audioPrompt") || compiled.finalPrompt;
  const format = input.format ?? "wav";
  const job = await createGenerationJob(db, {
    projectId: compiled.projectId,
    panelId: input.panelId,
    type: GenerationJobType.AUDIO,
    provider: compiled.provider,
    model: compiled.model,
    compiledPrompt: compiled.finalPrompt,
    inputLayers: compiled.snapshotPayload.layers as unknown as Prisma.InputJsonValue,
    attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
    requestPayload: {
      narration,
      voiceId: input.voiceId ?? panel.project.modelStack?.defaultVoiceId ?? null,
      pace: input.pace ?? "normal",
      emotion: input.emotion ?? null,
      format,
      promptPurpose: compiled.purpose
    }
  });
  await storePromptCompilation(db, compiled, { generationJobId: job.id });

  const payload: AudioJobPayload = {
    jobType: "audio",
    projectId: panel.projectId,
    panelId: input.panelId,
    generationJobId: job.id,
    requestedAt: nowIso(options.now),
    narration,
    voiceId: input.voiceId ?? panel.project.modelStack?.defaultVoiceId ?? undefined,
    pace: input.pace ?? "normal",
    emotion: input.emotion ?? undefined,
    format
  };

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: async (assetId) => {
      await selectPanelAsset(db, input.panelId, assetId, AssetType.AUDIO);
    }
  });
}

async function runMediaJob<TPayload extends ImageJobPayload | VideoJobPayload | AudioJobPayload>(
  db: DbClient,
  generationJobId: string,
  payload: TPayload,
  options: GenerationServiceOptions & {
    onAssetCreated: (assetId: string) => Promise<void>;
  }
) {
  const startedAt = options.now?.() ?? new Date();
  const storage = options.storage ?? new LocalStorageDriver();

  await updateGenerationJobStatus(db, generationJobId, JobStatus.RUNNING, {
    requestPayload: payload as unknown as Prisma.InputJsonValue,
    logs: [{ at: startedAt.toISOString(), message: "Manual generation started." }]
  });

  try {
    const provider = createFakeProviderForJob(payload.jobType);
    const result = await runProvider(provider, payload);
    const assetIds: string[] = [];

    for (const contract of "assets" in result ? result.assets : []) {
      const asset = await persistGeneratedAsset(db, storage, payload, generationJobId, contract);
      assetIds.push(asset.id);
      await options.onAssetCreated(asset.id);
    }

    const completedAt = options.now?.() ?? new Date();
    const completed = await updateGenerationJobStatus(db, generationJobId, JobStatus.COMPLETED, {
      responsePayloadSummary: summarizeProviderResult(result) as unknown as Prisma.InputJsonValue,
      outputAssetIds: assetIds,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      costEstimate: result.costEstimate ? new Prisma.Decimal(result.costEstimate.amount) : undefined,
      logs: [
        { at: startedAt.toISOString(), message: "Manual generation started." },
        { at: completedAt.toISOString(), message: `Generated ${assetIds.length} asset(s).` }
      ]
    });

    return { job: completed, assetIds };
  } catch (error) {
    const failedAt = options.now?.() ?? new Date();
    const failed = await updateGenerationJobStatus(db, generationJobId, JobStatus.FAILED, {
      durationMs: Math.max(0, failedAt.getTime() - startedAt.getTime()),
      errorPayload: serializeError(error) as Prisma.InputJsonValue,
      logs: [
        { at: startedAt.toISOString(), message: "Manual generation started." },
        { at: failedAt.toISOString(), message: "Generation failed." }
      ]
    });

    return { job: failed, assetIds: [] };
  }
}

async function persistGeneratedAsset<TPayload extends ImageJobPayload | VideoJobPayload | AudioJobPayload>(
  db: DbClient,
  storage: StorageDriver,
  payload: TPayload,
  generationJobId: string,
  contract: GeneratedAssetContract
) {
  const storagePath = contract.storagePath ?? buildStoragePath(payload, generationJobId, contract.fileName);
  const bytes = buildPlaceholderBytes(payload, contract);
  const stored = await storage.putObject({
    path: storagePath,
    bytes,
    contentType: contract.mimeType,
    metadata: {
      generationJobId,
      panelId: payload.panelId
    }
  });
  const assetType = assetTypeFromContract(contract);
  const metadata: Record<string, unknown> = {
    ...contract.metadata,
    frameRole: payload.jobType === "image" ? payload.frameRole ?? "image" : undefined,
    sourceImageAssetIds: payload.jobType === "video" ? payload.sourceImageAssetIds ?? [] : undefined,
    pace: payload.jobType === "audio" ? payload.pace ?? "normal" : undefined,
    emotion: payload.jobType === "audio" ? payload.emotion ?? null : undefined
  };

  return createGeneratedAsset(db, {
    projectId: payload.projectId,
    panelId: payload.panelId,
    generationJobId,
    assetType,
    fileUrl: stored.url,
    previewUrl: assetType === AssetType.IMAGE ? stored.url : null,
    storagePath: stored.path,
    mimeType: contract.mimeType,
    durationSeconds: numberFromMetadata(metadata.durationSeconds),
    width: numberFromMetadata(metadata.width),
    height: numberFromMetadata(metadata.height),
    metadata: metadata as Prisma.InputJsonValue
  });
}

async function selectPanelFrameAsset(
  db: DbClient,
  panelId: string,
  assetId: string,
  field: "firstFrameAssetId" | "lastFrameAssetId"
) {
  const current = await db.panel.findUnique({
    where: { id: panelId },
    select: { firstFrameAssetId: true, lastFrameAssetId: true }
  });
  const currentAssetId = field === "firstFrameAssetId" ? current?.firstFrameAssetId : current?.lastFrameAssetId;

  if (currentAssetId) {
    await db.generatedAsset.update({
      where: { id: currentAssetId },
      data: { isSelected: false }
    }).catch(() => null);
  }

  await db.generatedAsset.update({
    where: { id: assetId },
    data: { isSelected: true }
  });
  await db.panel.update({
    where: { id: panelId },
    data: { [field]: assetId }
  });
}

async function selectPanelPrimaryImageAsset(db: DbClient, panelId: string, assetId: string) {
  const current = await db.panel.findUnique({
    where: { id: panelId },
    select: { selectedImageAssetId: true }
  });

  if (current?.selectedImageAssetId) {
    await db.generatedAsset.update({
      where: { id: current.selectedImageAssetId },
      data: { isSelected: false }
    }).catch(() => null);
  }

  await db.generatedAsset.update({
    where: { id: assetId },
    data: { isSelected: true }
  });
  await db.panel.update({
    where: { id: panelId },
    data: { selectedImageAssetId: assetId }
  });
}

function buildStoragePath<TPayload extends ImageJobPayload | VideoJobPayload | AudioJobPayload>(
  payload: TPayload,
  generationJobId: string,
  fileName: string
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `projects/${payload.projectId}/panels/${payload.panelId}/${generationJobId}/${safeName}`;
}

function buildPlaceholderBytes<TPayload extends ImageJobPayload | VideoJobPayload | AudioJobPayload>(
  payload: TPayload,
  contract: GeneratedAssetContract
) {
  const promptPreview = getPayloadText(payload).slice(0, 320).replace(/[<>&]/g, "");

  if (contract.mimeType === "image/svg+xml") {
    const label = payload.jobType === "image" ? payload.frameRole ?? "image" : payload.jobType;
    return new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#111827"/><rect x="72" y="96" width="936" height="1728" rx="28" fill="#f8fafc"/><text x="120" y="210" font-family="Arial" font-size="54" fill="#111827">Vocta ${label}</text><foreignObject x="120" y="280" width="840" height="1300"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;font-size:34px;line-height:1.35;color:#374151">${promptPreview}</div></foreignObject></svg>`
    );
  }

  return new TextEncoder().encode(`VOCTA_FAKE_${payload.jobType.toUpperCase()}_PLACEHOLDER\n${promptPreview}\n`);
}

function getPayloadText(payload: ImageJobPayload | VideoJobPayload | AudioJobPayload) {
  if (payload.jobType === "audio") return payload.narration;
  return payload.prompt;
}

function assetTypeFromContract(contract: GeneratedAssetContract) {
  if (contract.assetType === "image") return AssetType.IMAGE;
  if (contract.assetType === "video") return AssetType.VIDEO;
  if (contract.assetType === "audio") return AssetType.AUDIO;
  if (contract.assetType === "reference") return AssetType.REFERENCE;
  return AssetType.FILE;
}

function numberFromMetadata(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function summarizeProviderResult(result: Awaited<ReturnType<typeof runProvider>>) {
  return {
    jobType: result.jobType,
    provider: result.provider,
    model: result.model,
    summary: result.summary,
    warnings: result.warnings,
    metadata: result.metadata,
    costEstimate: result.costEstimate,
    assets: "assets" in result
      ? result.assets.map((asset) => ({
          assetType: asset.assetType,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          metadata: asset.metadata
        }))
      : [],
    durationSeconds: "durationSeconds" in result ? result.durationSeconds : undefined
  };
}

function extractNegativePrompt(prompt: string) {
  const match = prompt.match(/Negative prompt rules:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim();
}

function extractPromptField(metadata: Prisma.JsonValue, field: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const promptFields = (metadata as Prisma.JsonObject).promptFields;
  if (!promptFields || typeof promptFields !== "object" || Array.isArray(promptFields)) return "";
  const value = (promptFields as Prisma.JsonObject)[field];
  return typeof value === "string" ? value.trim() : "";
}

function buildAudioUserNotes(input: GeneratePanelAudioInput) {
  const lines = [
    "Generate voiceover audio for this panel.",
    input.pace ? `Intended speaking pace: ${input.pace}.` : null,
    input.emotion ? `Emotion: ${input.emotion}.` : null
  ];

  return lines.filter(Boolean).join("\n");
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
}

function nowIso(now?: () => Date) {
  return (now?.() ?? new Date()).toISOString();
}
