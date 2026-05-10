import { AssetType, GenerationJobType, JobStatus, Prisma, PromptPurpose } from "@prisma/client";

import {
  createGeneratedAsset,
  createGenerationJob,
  selectPanelAsset,
  updateGenerationJobStatus,
  type DbClient
} from "@/server/db/repositories";
import { createQueues, enqueueGenerationJob, type VoctaQueueMap } from "@/server/jobs/queues";
import { normalizeAudioSettings, normalizeVideoSettings } from "@/features/generation/settings";
import type {
  AudioJobPayload,
  GeneratedAssetContract,
  ImageJobPayload,
  VideoJobPayload,
} from "@/server/jobs/types";
import { compilePanelPrompt, storePromptCompilation } from "@/server/prompting/service";
import { resolveProviderAdapter } from "@/server/providers/registry";
import { runProvider } from "@/server/providers/run";
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
  aspectRatio?: VideoJobPayload["aspectRatio"];
  resolution?: VideoJobPayload["resolution"];
  sourceMode?: VideoJobPayload["sourceMode"];
};

export type GeneratePanelAudioInput = {
  panelId: string;
  speakerEntityId?: string | null;
  voiceId?: string | null;
  voiceLabel?: string | null;
  voiceNotes?: string | null;
  pace?: AudioJobPayload["pace"];
  emotion?: string | null;
  speakingRate?: number | null;
  pitch?: number | null;
  format?: AudioJobPayload["format"];
};

type GenerationServiceOptions = {
  storage?: StorageDriver;
  now?: () => Date;
};

type GenerationRequestOptions = GenerationServiceOptions & {
  queues?: VoctaQueueMap;
};

type QueuedGenerationResult = {
  job: Awaited<ReturnType<typeof createGenerationJob>>;
  panel: Awaited<ReturnType<typeof loadPanelWithGenerationState>>;
  queueJobId?: string;
};

const DEFAULT_ASPECT_RATIO = "9:16";

export async function requestPanelImage(
  db: DbClient,
  input: GeneratePanelImageInput,
  options: GenerationRequestOptions = {}
): Promise<QueuedGenerationResult> {
  const { job, payload } = await createImageGenerationRequest(db, input, options);
  const queueJobId = await enqueueQueuedGenerationPayload(db, job.id, payload, options.queues);
  const panel = await loadPanelWithGenerationState(db, input.panelId);

  return { job: await db.generationJob.findUniqueOrThrow({ where: { id: job.id } }), panel, queueJobId };
}

export async function requestPanelVideo(
  db: DbClient,
  input: GeneratePanelVideoInput,
  options: GenerationRequestOptions = {}
): Promise<QueuedGenerationResult> {
  const { job, payload } = await createVideoGenerationRequest(db, input, options);
  const queueJobId = await enqueueQueuedGenerationPayload(db, job.id, payload, options.queues);
  const panel = await loadPanelWithGenerationState(db, input.panelId);

  return { job: await db.generationJob.findUniqueOrThrow({ where: { id: job.id } }), panel, queueJobId };
}

export async function requestPanelAudio(
  db: DbClient,
  input: GeneratePanelAudioInput,
  options: GenerationRequestOptions = {}
): Promise<QueuedGenerationResult> {
  const { job, payload } = await createAudioGenerationRequest(db, input, options);
  const queueJobId = await enqueueQueuedGenerationPayload(db, job.id, payload, options.queues);
  const panel = await loadPanelWithGenerationState(db, input.panelId);

  return { job: await db.generationJob.findUniqueOrThrow({ where: { id: job.id } }), panel, queueJobId };
}

export async function generatePanelImage(
  db: DbClient,
  input: GeneratePanelImageInput,
  options: GenerationServiceOptions = {}
) {
  const { job, payload, frameRole } = await createImageGenerationRequest(db, input, options);

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: imageSelectionHandler(db, input.panelId, frameRole)
  });
}

async function createImageGenerationRequest(
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
  await db.generationJob.update({
    where: { id: job.id },
    data: {
      requestPayload: payload as unknown as Prisma.InputJsonValue,
      logs: [{ at: payload.requestedAt, message: "Manual image generation queued." }]
    }
  });

  return { job, payload, frameRole };
}

export async function generatePanelVideo(
  db: DbClient,
  input: GeneratePanelVideoInput,
  options: GenerationServiceOptions = {}
) {
  const { job, payload } = await createVideoGenerationRequest(db, input, options);

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: async (assetId) => {
      await selectPanelAsset(db, input.panelId, assetId, AssetType.VIDEO);
    }
  });
}

async function createVideoGenerationRequest(
  db: DbClient,
  input: GeneratePanelVideoInput,
  options: GenerationServiceOptions = {}
) {
  const panel = await db.panel.findUniqueOrThrow({
    where: { id: input.panelId },
    select: {
      projectId: true,
      targetDurationSeconds: true,
      timelineMetadata: true,
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
  const videoSettings = normalizeVideoSettings(extractMetadataField(panel.timelineMetadata, "videoSettings"));
  const durationSeconds = input.durationSeconds ?? videoSettings.durationSeconds ?? panel.targetDurationSeconds ?? 6;
  const aspectRatio = input.aspectRatio ?? videoSettings.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const resolution = input.resolution ?? videoSettings.resolution;
  const sourceMode = input.sourceMode ?? videoSettings.sourceMode;
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
      aspectRatio,
      resolution,
      sourceMode,
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
    aspectRatio,
    resolution,
    sourceMode,
    durationSeconds,
    sourceImageAssetIds,
    references: compiled.attachedReferenceAssetIds.map((id) => ({ id, type: "asset" }))
  };
  await db.generationJob.update({
    where: { id: job.id },
    data: {
      requestPayload: payload as unknown as Prisma.InputJsonValue,
      logs: [{ at: payload.requestedAt, message: "Manual video generation queued." }]
    }
  });

  return { job, payload };
}

export async function generatePanelAudio(
  db: DbClient,
  input: GeneratePanelAudioInput,
  options: GenerationServiceOptions = {}
) {
  const { job, payload } = await createAudioGenerationRequest(db, input, options);

  return runMediaJob(db, job.id, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: async (assetId) => {
      await selectPanelAsset(db, input.panelId, assetId, AssetType.AUDIO);
    }
  });
}

async function createAudioGenerationRequest(
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
          },
          entities: true
        }
      }
    }
  });
  const audioSettings = normalizeAudioSettings(extractMetadataField(panel.timelineMetadata, "audioSettings"));
  const speakerEntityId = input.speakerEntityId ?? audioSettings.speakerEntityId ?? undefined;
  const speakerEntity = speakerEntityId
    ? panel.project.entities.find((entity) => entity.id === speakerEntityId)
    : null;
  const speakerMetadata = metadataObject(speakerEntity?.metadata);
  const compiled = await compilePanelPrompt(db, {
    panelId: input.panelId,
    purpose: PromptPurpose.AUDIO,
    userNotes: buildAudioUserNotes(input)
  });
  const narration = panel.narrationText?.trim() || extractPromptField(panel.timelineMetadata, "audioPrompt") || compiled.finalPrompt;
  const format = input.format ?? "wav";
  const resolvedVoiceId =
    input.voiceId ??
    audioSettings.voiceId ??
    stringMetadata(speakerMetadata.voiceId) ??
    panel.project.modelStack?.defaultVoiceId ??
    null;
  const resolvedVoiceLabel = input.voiceLabel ?? audioSettings.voiceLabel ?? stringMetadata(speakerMetadata.voiceLabel) ?? null;
  const resolvedVoiceNotes = input.voiceNotes ?? audioSettings.voiceNotes ?? stringMetadata(speakerMetadata.voiceNotes) ?? null;
  const resolvedEmotion = input.emotion ?? audioSettings.emotion ?? stringMetadata(speakerMetadata.defaultEmotion) ?? null;
  const resolvedSpeakingRate = input.speakingRate ?? audioSettings.speakingRate ?? numberMetadata(speakerMetadata.speakingRate);
  const resolvedPitch = input.pitch ?? audioSettings.pitch ?? numberMetadata(speakerMetadata.pitch);
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
      speakerEntityId: speakerEntityId ?? null,
      voiceId: resolvedVoiceId,
      voiceLabel: resolvedVoiceLabel,
      voiceNotes: resolvedVoiceNotes,
      pace: input.pace ?? "normal",
      emotion: resolvedEmotion,
      speakingRate: resolvedSpeakingRate,
      pitch: resolvedPitch,
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
    speakerEntityId,
    voiceId: resolvedVoiceId ?? undefined,
    voiceLabel: resolvedVoiceLabel ?? undefined,
    voiceNotes: resolvedVoiceNotes ?? undefined,
    pace: input.pace ?? "normal",
    emotion: resolvedEmotion ?? undefined,
    speakingRate: resolvedSpeakingRate ?? undefined,
    pitch: resolvedPitch ?? undefined,
    format
  };
  await db.generationJob.update({
    where: { id: job.id },
    data: {
      requestPayload: payload as unknown as Prisma.InputJsonValue,
      logs: [{ at: payload.requestedAt, message: "Manual audio generation queued." }]
    }
  });

  return { job, payload };
}

export async function executeQueuedGenerationJob(
  db: DbClient,
  payload: ImageJobPayload | VideoJobPayload | AudioJobPayload,
  options: GenerationServiceOptions = {}
) {
  if (!payload.generationJobId) {
    throw new Error("Queued generation payload is missing generationJobId.");
  }

  const existingJob = await db.generationJob.findUniqueOrThrow({
    where: { id: payload.generationJobId },
    select: { status: true, provider: true, model: true }
  });

  if (existingJob.status === JobStatus.CANCELLED) {
    return {
      jobType: payload.jobType,
      provider: "vocta",
      model: "cancelled",
      completedAt: nowIso(options.now),
      summary: "Generation job was cancelled before execution.",
      warnings: [],
      metadata: { generationJobId: payload.generationJobId, cancelled: true }
    };
  }

  const result = await runMediaJob(db, payload.generationJobId, payload, {
    storage: options.storage,
    now: options.now,
    onAssetCreated: assetSelectionHandler(db, payload)
  });

  if (result.job.status === JobStatus.FAILED) {
    throw new Error(`Generation job ${payload.generationJobId} failed.`);
  }

  return result.providerResult;
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

  const jobProvider = await db.generationJob.findUniqueOrThrow({
    where: { id: generationJobId },
    select: { provider: true, model: true }
  });
  const providerRuntime = resolveProviderAdapter({
    jobType: payload.jobType,
    provider: jobProvider.provider,
    model: jobProvider.model
  });
  const runtimePayload = withProviderRuntimeMetadata(payload, providerRuntime);
  const startedLogs = [
    { at: startedAt.toISOString(), message: "Manual generation started." },
    {
      at: startedAt.toISOString(),
      message: `Provider adapter selected: ${providerRuntime.runtimeProvider}/${providerRuntime.runtimeModel} (${providerRuntime.mode} mode).`
    },
    providerRuntime.fallbackReason
      ? { at: startedAt.toISOString(), message: `Provider fallback: ${providerRuntime.fallbackReason}` }
      : null
  ].filter((entry): entry is { at: string; message: string } => Boolean(entry));

  await updateGenerationJobStatus(db, generationJobId, JobStatus.RUNNING, {
    requestPayload: runtimePayload as unknown as Prisma.InputJsonValue,
    logs: startedLogs
  });

  try {
    const result = await runProvider(providerRuntime.adapter, runtimePayload);
    const assetIds: string[] = [];

    for (const contract of "assets" in result ? result.assets : []) {
      const asset = await persistGeneratedAsset(db, storage, runtimePayload, generationJobId, contract);
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
        ...startedLogs,
        { at: completedAt.toISOString(), message: `Generated ${assetIds.length} asset(s).` }
      ]
    });

    return { job: completed, assetIds, providerResult: result };
  } catch (error) {
    const failedAt = options.now?.() ?? new Date();
    const failed = await updateGenerationJobStatus(db, generationJobId, JobStatus.FAILED, {
      durationMs: Math.max(0, failedAt.getTime() - startedAt.getTime()),
      errorPayload: serializeError(error) as Prisma.InputJsonValue,
      logs: [
        ...startedLogs,
        { at: failedAt.toISOString(), message: "Generation failed." }
      ]
    });

    return { job: failed, assetIds: [], providerResult: null };
  }
}

async function enqueueQueuedGenerationPayload(
  db: DbClient,
  generationJobId: string,
  payload: ImageJobPayload | VideoJobPayload | AudioJobPayload,
  queues = createQueues()
) {
  try {
    const queueJob = await enqueueGenerationJob(queues, payload, { jobId: generationJobId });
    return queueJob.id;
  } catch (error) {
    await updateGenerationJobStatus(db, generationJobId, JobStatus.FAILED, {
      errorPayload: serializeError(error) as Prisma.InputJsonValue,
      logs: [
        { at: nowIso(), message: "Generation enqueue failed." }
      ]
    });
    throw error;
  }
}

function imageSelectionHandler(db: DbClient, panelId: string, frameRole: ImageFrameRole) {
  return async (assetId: string) => {
    if (frameRole === "first_frame") {
      await selectPanelFrameAsset(db, panelId, assetId, "firstFrameAssetId");
      return;
    }

    if (frameRole === "last_frame") {
      await selectPanelFrameAsset(db, panelId, assetId, "lastFrameAssetId");
      return;
    }

    await selectPanelPrimaryImageAsset(db, panelId, assetId);
  };
}

function assetSelectionHandler(db: DbClient, payload: ImageJobPayload | VideoJobPayload | AudioJobPayload) {
  if (payload.jobType === "image") {
    return imageSelectionHandler(db, payload.panelId, payload.frameRole ?? "image");
  }

  if (payload.jobType === "video") {
    return async (assetId: string) => {
      await selectPanelAsset(db, payload.panelId, assetId, AssetType.VIDEO);
    };
  }

  return async (assetId: string) => {
    await selectPanelAsset(db, payload.panelId, assetId, AssetType.AUDIO);
  };
}

async function loadPanelWithGenerationState(db: DbClient, panelId: string) {
  return db.panel.findUniqueOrThrow({
    where: { id: panelId },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
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
    resolution: payload.jobType === "video" ? payload.resolution ?? "720p" : undefined,
    sourceMode: payload.jobType === "video" ? payload.sourceMode ?? "text_to_video" : undefined,
    pace: payload.jobType === "audio" ? payload.pace ?? "normal" : undefined,
    speakerEntityId: payload.jobType === "audio" ? payload.speakerEntityId ?? null : undefined,
    voiceId: payload.jobType === "audio" ? payload.voiceId ?? null : undefined,
    voiceLabel: payload.jobType === "audio" ? payload.voiceLabel ?? null : undefined,
    voiceNotes: payload.jobType === "audio" ? payload.voiceNotes ?? null : undefined,
    emotion: payload.jobType === "audio" ? payload.emotion ?? null : undefined,
    speakingRate: payload.jobType === "audio" ? payload.speakingRate ?? null : undefined,
    pitch: payload.jobType === "audio" ? payload.pitch ?? null : undefined
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

function withProviderRuntimeMetadata<TPayload extends ImageJobPayload | VideoJobPayload | AudioJobPayload>(
  payload: TPayload,
  providerRuntime: {
    mode: string;
    configuredProvider: string;
    configuredModel: string;
    runtimeProvider: string;
    runtimeModel: string;
    fallbackReason?: string;
  }
): TPayload {
  const providerRuntimeSnapshot = {
    mode: providerRuntime.mode,
    configuredProvider: providerRuntime.configuredProvider,
    configuredModel: providerRuntime.configuredModel,
    runtimeProvider: providerRuntime.runtimeProvider,
    runtimeModel: providerRuntime.runtimeModel,
    fallbackReason: providerRuntime.fallbackReason
  };

  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      providerRuntime: providerRuntimeSnapshot
    }
  };
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

function extractMetadataField(metadata: Prisma.JsonValue, field: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = (metadata as Prisma.JsonObject)[field];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function metadataObject(value: Prisma.JsonValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Prisma.JsonObject : {};
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberMetadata(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildAudioUserNotes(input: GeneratePanelAudioInput) {
  const lines = [
    "Generate voiceover audio for this panel.",
    input.speakerEntityId ? `Speaker entity ID: ${input.speakerEntityId}.` : null,
    input.voiceId ? `Voice ID override: ${input.voiceId}.` : null,
    input.voiceLabel ? `Voice label: ${input.voiceLabel}.` : null,
    input.voiceNotes ? `Voice notes: ${input.voiceNotes}.` : null,
    input.pace ? `Intended speaking pace: ${input.pace}.` : null,
    input.emotion ? `Emotion: ${input.emotion}.` : null,
    input.speakingRate ? `Speaking rate: ${input.speakingRate}.` : null,
    input.pitch ? `Pitch: ${input.pitch}.` : null
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
