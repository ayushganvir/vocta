import { GenerationJobType, JobStatus, Prisma, type PrismaClient } from "@prisma/client";

import type { DbClient } from "@/server/db/repositories";
import { createQueues, enqueueGenerationJob, type VoctaQueueMap } from "@/server/jobs/queues";
import type { JobPayload } from "@/server/jobs/types";

const jobInclude = {
  project: {
    select: {
      id: true,
      title: true
    }
  },
  panel: {
    select: {
      id: true,
      orderIndex: true,
      title: true,
      scene: {
        select: {
          id: true,
          orderIndex: true,
          title: true
        }
      }
    }
  },
  retryOfGenerationJob: {
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true
    }
  },
  retries: {
    select: {
      id: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  },
  generatedAssets: {
    select: {
      id: true,
      assetType: true,
      fileUrl: true,
      previewUrl: true,
      mimeType: true,
      durationSeconds: true,
      width: true,
      height: true,
      isSelected: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.GenerationJobInclude;

type JobWithRelations = Prisma.GenerationJobGetPayload<{ include: typeof jobInclude }>;

export type ListJobsInput = {
  projectId?: string;
  panelId?: string;
  status?: JobStatus;
  type?: GenerationJobType;
  limit?: number;
  cursor?: string;
};

export type JobListResponse = {
  jobs: JobSummary[];
  nextCursor: string | null;
};

export type JobTarget = {
  kind: "project" | "panel";
  label: string;
  projectId: string;
  projectTitle: string;
  panelId: string | null;
  panelTitle: string | null;
  panelOrderIndex: number | null;
  sceneId: string | null;
  sceneTitle: string | null;
  sceneOrderIndex: number | null;
};

export type JobSummary = {
  id: string;
  projectId: string;
  panelId: string | null;
  type: GenerationJobType;
  status: JobStatus;
  provider: string;
  model: string;
  target: JobTarget;
  retryOfGenerationJobId: string | null;
  retryCount: number;
  outputAssetCount: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  canRetry: boolean;
  canCancel: boolean;
};

export type JobDetail = JobSummary & {
  compiledPrompt: string | null;
  inputLayers: unknown;
  attachedReferenceAssetIds: unknown;
  requestPayload: unknown;
  responsePayloadSummary: unknown;
  outputAssetIds: unknown;
  logs: unknown;
  errorPayload: unknown;
  costEstimate: string | null;
  tokenUsage: unknown;
  createdById: string | null;
  retryOf: {
    id: string;
    type: GenerationJobType;
    status: JobStatus;
    createdAt: string;
  } | null;
  retries: Array<{
    id: string;
    status: JobStatus;
    createdAt: string;
  }>;
  generatedAssets: Array<{
    id: string;
    assetType: string;
    fileUrl: string;
    previewUrl: string | null;
    mimeType: string;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    isSelected: boolean;
    createdAt: string;
  }>;
};

type RetryGenerationJobOptions = {
  queues?: VoctaQueueMap;
  now?: () => Date;
};

export async function listJobs(db: PrismaClient, input: ListJobsInput = {}): Promise<JobListResponse> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const jobs = await db.generationJob.findMany({
    where: {
      projectId: input.projectId,
      panelId: input.panelId,
      status: input.status,
      type: input.type
    },
    include: jobInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
  });
  const page = jobs.slice(0, limit);

  return {
    jobs: page.map(serializeJobSummary),
    nextCursor: jobs.length > limit ? page[page.length - 1]?.id ?? null : null
  };
}

export async function getJobDetail(db: PrismaClient, jobId: string): Promise<JobDetail | null> {
  const job = await db.generationJob.findUnique({
    where: { id: jobId },
    include: jobInclude
  });

  return job ? serializeJobDetail(job) : null;
}

export async function retryGenerationJob(db: DbClient, jobId: string, options: RetryGenerationJobOptions = {}) {
  const source = await db.generationJob.findUnique({
    where: { id: jobId }
  });

  if (!source) {
    return null;
  }

  if (source.status !== JobStatus.FAILED && source.status !== JobStatus.CANCELLED) {
    throw new Error("Only failed or cancelled jobs can be retried manually.");
  }

  const requestedAt = (options.now?.() ?? new Date()).toISOString();
  const retry = await db.generationJob.create({
    data: {
      projectId: source.projectId,
      panelId: source.panelId,
      type: source.type,
      provider: source.provider,
      model: source.model,
      status: JobStatus.QUEUED,
      inputLayers: jsonInput(source.inputLayers, []),
      attachedReferenceAssetIds: jsonInput(source.attachedReferenceAssetIds, []),
      compiledPrompt: source.compiledPrompt,
      requestPayload: addManualRetryMetadata(source.requestPayload, source.id, requestedAt),
      retryOfGenerationJobId: source.id,
      createdById: source.createdById,
      logs: appendLog(source.logs, {
        level: "info",
        message: "Manual retry job queued from failed/cancelled source job.",
        at: requestedAt
      })
    }
  });

  const executablePayload = buildRetryQueuePayload(source.requestPayload, retry.id, source.id, requestedAt);

  if (!executablePayload) {
    return retry;
  }

  try {
    const queues = options.queues ?? createQueues();
    await enqueueGenerationJob(queues, executablePayload, { jobId: retry.id });
    return db.generationJob.findUniqueOrThrow({ where: { id: retry.id } });
  } catch (error) {
    await db.generationJob.update({
      where: { id: retry.id },
      data: {
        status: JobStatus.FAILED,
        completedAt: options.now?.() ?? new Date(),
        errorPayload: serializeError(error) as Prisma.InputJsonValue,
        logs: appendLog(retry.logs, {
          level: "error",
          message: "Manual retry enqueue failed.",
          at: (options.now?.() ?? new Date()).toISOString()
        })
      }
    });
    throw error;
  }
}

export async function cancelGenerationJob(db: DbClient, jobId: string) {
  const source = await db.generationJob.findUnique({
    where: { id: jobId }
  });

  if (!source) {
    return null;
  }

  if (source.status !== JobStatus.QUEUED && source.status !== JobStatus.RUNNING) {
    throw new Error("Only queued or running jobs can be cancelled.");
  }

  return db.generationJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CANCELLED,
      completedAt: new Date(),
      logs: appendLog(source.logs, {
        level: "info",
        message: "Job cancelled manually from the jobs workspace.",
        at: new Date().toISOString()
      })
    }
  });
}

export function serializeJobSummary(job: JobWithRelations): JobSummary {
  return {
    id: job.id,
    projectId: job.projectId,
    panelId: job.panelId,
    type: job.type,
    status: job.status,
    provider: job.provider,
    model: job.model,
    target: buildTarget(job),
    retryOfGenerationJobId: job.retryOfGenerationJobId,
    retryCount: job.retries.length,
    outputAssetCount: job.generatedAssets.length,
    errorMessage: readErrorMessage(job.errorPayload),
    durationMs: job.durationMs,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    canRetry: job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED,
    canCancel: job.status === JobStatus.QUEUED || job.status === JobStatus.RUNNING
  };
}

export function serializeJobDetail(job: JobWithRelations): JobDetail {
  return {
    ...serializeJobSummary(job),
    compiledPrompt: job.compiledPrompt,
    inputLayers: job.inputLayers,
    attachedReferenceAssetIds: job.attachedReferenceAssetIds,
    requestPayload: job.requestPayload,
    responsePayloadSummary: job.responsePayloadSummary,
    outputAssetIds: job.outputAssetIds,
    logs: job.logs,
    errorPayload: job.errorPayload,
    costEstimate: job.costEstimate?.toString() ?? null,
    tokenUsage: job.tokenUsage,
    createdById: job.createdById,
    retryOf: job.retryOfGenerationJob
      ? {
          id: job.retryOfGenerationJob.id,
          type: job.retryOfGenerationJob.type,
          status: job.retryOfGenerationJob.status,
          createdAt: job.retryOfGenerationJob.createdAt.toISOString()
        }
      : null,
    retries: job.retries.map((retry) => ({
      id: retry.id,
      status: retry.status,
      createdAt: retry.createdAt.toISOString()
    })),
    generatedAssets: job.generatedAssets.map((asset) => ({
      id: asset.id,
      assetType: asset.assetType,
      fileUrl: asset.fileUrl,
      previewUrl: asset.previewUrl,
      mimeType: asset.mimeType,
      durationSeconds: asset.durationSeconds,
      width: asset.width,
      height: asset.height,
      isSelected: asset.isSelected,
      createdAt: asset.createdAt.toISOString()
    }))
  };
}

function buildTarget(job: JobWithRelations): JobTarget {
  if (!job.panel) {
    return {
      kind: "project",
      label: job.project.title,
      projectId: job.project.id,
      projectTitle: job.project.title,
      panelId: null,
      panelTitle: null,
      panelOrderIndex: null,
      sceneId: null,
      sceneTitle: null,
      sceneOrderIndex: null
    };
  }

  const label = `S${job.panel.scene.orderIndex}.P${job.panel.orderIndex} ${job.panel.title}`;

  return {
    kind: "panel",
    label,
    projectId: job.project.id,
    projectTitle: job.project.title,
    panelId: job.panel.id,
    panelTitle: job.panel.title,
    panelOrderIndex: job.panel.orderIndex,
    sceneId: job.panel.scene.id,
    sceneTitle: job.panel.scene.title,
    sceneOrderIndex: job.panel.scene.orderIndex
  };
}

function readErrorMessage(errorPayload: unknown) {
  if (!errorPayload) return null;
  if (typeof errorPayload === "string") return errorPayload;
  if (typeof errorPayload !== "object" || Array.isArray(errorPayload)) return null;

  const record = errorPayload as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.reason;

  return typeof message === "string" ? message : null;
}

function jsonInput(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (value === undefined || value === null) return fallback;
  return value as Prisma.InputJsonValue;
}

function appendLog(logs: unknown, entry: Record<string, unknown>): Prisma.InputJsonValue {
  const current = Array.isArray(logs) ? logs : [];
  return [...current, entry] as Prisma.InputJsonValue;
}

function addManualRetryMetadata(payload: unknown, retryOfJobId: string, requestedAt: string): Prisma.InputJsonValue {
  const base =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};

  return {
    ...base,
    manualRetryOfJobId: retryOfJobId,
    requestedAt
  } as Prisma.InputJsonValue;
}

function buildRetryQueuePayload(
  payload: unknown,
  retryJobId: string,
  retryOfJobId: string,
  requestedAt: string
): JobPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const base = payload as Record<string, unknown>;
  const jobType = base.jobType;

  if (jobType !== "image" && jobType !== "video" && jobType !== "audio") {
    return null;
  }

  return {
    ...base,
    jobType,
    generationJobId: retryJobId,
    manualRetryOfJobId: retryOfJobId,
    requestedAt
  } as JobPayload;
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
